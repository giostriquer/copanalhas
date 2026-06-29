export type DecisionMethod = "regular" | "extra_time" | "penalties";
export type ScoreAward = "solo" | "exact" | "outcome" | "closest" | "decision_bonus";
type MatchOutcome = "home" | "away" | "draw";
export type MatchWinner = Exclude<MatchOutcome, "draw">;
export type MatchPhaseForScoring =
  | "group"
  | "round_of_32"
  | "round_of_16"
  | "quarter_final"
  | "semi_final"
  | "third_place"
  | "final";

export interface MatchResult {
  matchId: string;
  homeScore: number;
  awayScore: number;
  phase?: MatchPhaseForScoring;
  decisionMethod?: DecisionMethod | null;
  regularTimeHomeScore?: number | null;
  regularTimeAwayScore?: number | null;
  extraTimeHomeScore?: number | null;
  extraTimeAwayScore?: number | null;
  penaltyHomeScore?: number | null;
  penaltyAwayScore?: number | null;
  winner?: MatchWinner | null;
}

export interface ScorePrediction {
  userId: string;
  matchId: string;
  homeScore: number;
  awayScore: number;
  decisionMethod?: DecisionMethod | null;
}

export interface ScoredPrediction {
  userId: string;
  matchId: string;
  points: number;
  distance: number;
  awards: ScoreAward[];
}

export interface LeaderboardRow {
  userId: string;
  points: number;
  soloCount: number;
  exactCount: number;
  outcomeCount: number;
  closestCount: number;
  decisionBonusCount: number;
  matchesScored: number;
}

export function scoreMatch(
  result: MatchResult,
  predictions: ScorePrediction[]
): ScoredPrediction[] {
  if (isKnockoutResult(result)) {
    return scoreKnockoutMatch(result, predictions);
  }

  return scoreGroupMatch(result, predictions);
}

function scoreGroupMatch(result: MatchResult, predictions: ScorePrediction[]): ScoredPrediction[] {
  const rows = predictions
    .filter((prediction) => prediction.matchId === result.matchId)
    .map((prediction) => predictionScoreRow(prediction, result));

  const resultOutcome = outcomeForScore(result.homeScore, result.awayScore);
  const exactCount = rows.filter((row) => row.isExact).length;
  const outcomeCount =
    exactCount === 0 ? rows.filter((row) => row.outcome === resultOutcome).length : 0;
  const closestMetric =
    exactCount === 0 && outcomeCount === 0 ? minClosestMetric(rows) : undefined;

  return rows.map((row) => {
    const awards: ScoreAward[] = [];
    let points = 0;

    if (row.isExact) {
      if (exactCount === 1) {
        awards.push("solo");
        points += 5;
      } else {
        awards.push("exact");
        points += 3;
      }
    }

    if (outcomeCount > 0 && row.outcome === resultOutcome) {
      awards.push("outcome");
      points += 2;
    }

    if (closestMetric && isClosest(row, closestMetric)) {
      awards.push("closest");
      points += 1;
    }

    return {
      userId: row.userId,
      matchId: row.matchId,
      points,
      distance: row.distance,
      awards
    };
  });
}

function scoreKnockoutMatch(
  result: MatchResult & { decisionMethod: DecisionMethod },
  predictions: ScorePrediction[]
): ScoredPrediction[] {
  const matchPredictions = predictions.filter((prediction) => prediction.matchId === result.matchId);
  const regularScore = scoreLayer(
    result.regularTimeHomeScore,
    result.regularTimeAwayScore,
    result.decisionMethod === "regular" ? result : undefined
  );
  const extraTimeScore = scoreLayer(result.extraTimeHomeScore, result.extraTimeAwayScore);
  const finalScore = { homeScore: result.homeScore, awayScore: result.awayScore };

  if (result.decisionMethod === "regular") {
    const regularResult = {
      ...result,
      homeScore: regularScore?.homeScore ?? result.homeScore,
      awayScore: regularScore?.awayScore ?? result.awayScore,
      decisionMethod: null
    };

    return addDecisionBonus(
      scoreGroupMatch(regularResult, matchPredictions),
      matchPredictions,
      result.decisionMethod
    );
  }

  const regularRows = matchPredictions.map((prediction) =>
    predictionScoreRow(prediction, regularScore ?? finalScore)
  );
  const extraTimeRows = matchPredictions.map((prediction) =>
    predictionScoreRow(prediction, extraTimeScore ?? regularScore ?? finalScore)
  );
  const regularExactCount = regularScore
    ? regularRows.filter((row) => isExactScore(row, regularScore)).length
    : 0;
  const extraTimeExactCount =
    regularExactCount === 0 && extraTimeScore
      ? extraTimeRows.filter((row) => isExactScore(row, extraTimeScore)).length
      : 0;

  return matchPredictions.map((prediction, index) => {
    const regularRow = regularRows[index];
    const extraTimeRow = extraTimeRows[index];
    const row = regularExactCount > 0 ? regularRow : extraTimeRow;
    const awards: ScoreAward[] = [];
    let points = 0;

    if (!regularRow || !extraTimeRow || !row) {
      throw new Error("Internal knockout scoring row mismatch");
    }

    if (regularScore && regularExactCount > 0 && isExactScore(regularRow, regularScore)) {
      if (regularExactCount === 1) {
        awards.push("solo");
        points += 5;
      } else {
        awards.push("exact");
        points += 3;
      }
    } else if (
      regularExactCount === 0 &&
      extraTimeScore &&
      extraTimeExactCount > 0 &&
      isExactScore(extraTimeRow, extraTimeScore)
    ) {
      awards.push("exact");
      points += 3;
    } else if (
      regularExactCount === 0 &&
      extraTimeExactCount === 0 &&
      result.decisionMethod === "penalties" &&
      result.winner &&
      row.outcome === result.winner
    ) {
      awards.push("outcome");
      points += 2;
    }

    if (prediction.decisionMethod === result.decisionMethod) {
      awards.push("decision_bonus");
      points += 2;
    }

    return {
      userId: row.userId,
      matchId: row.matchId,
      points,
      distance: row.distance,
      awards
    };
  });
}

function addDecisionBonus(
  scoredPredictions: ScoredPrediction[],
  predictions: ScorePrediction[],
  decisionMethod: DecisionMethod
): ScoredPrediction[] {
  const predictionsByUser = new Map(predictions.map((prediction) => [prediction.userId, prediction]));

  return scoredPredictions.map((scored) => {
    const prediction = predictionsByUser.get(scored.userId);

    if (prediction?.decisionMethod !== decisionMethod) {
      return scored;
    }

    return {
      ...scored,
      points: scored.points + 2,
      awards: [...scored.awards, "decision_bonus"]
    };
  });
}

export function buildLeaderboard(
  scoredPredictions: ScoredPrediction[],
  participantPredictions: readonly ScorePrediction[] = []
): LeaderboardRow[] {
  const rowsByUser = new Map<string, LeaderboardRow>();

  for (const prediction of participantPredictions) {
    if (!rowsByUser.has(prediction.userId)) {
      rowsByUser.set(prediction.userId, emptyLeaderboardRow(prediction.userId));
    }
  }

  for (const scored of scoredPredictions) {
    const row = rowsByUser.get(scored.userId) ?? emptyLeaderboardRow(scored.userId);

    row.points += scored.points;
    row.matchesScored += 1;

    if (scored.awards.includes("solo")) {
      row.soloCount += 1;
    }

    if (scored.awards.includes("exact")) {
      row.exactCount += 1;
    }

    if (scored.awards.includes("outcome")) {
      row.outcomeCount += 1;
    }

    if (scored.awards.includes("closest")) {
      row.closestCount += 1;
    }

    if (scored.awards.includes("decision_bonus")) {
      row.decisionBonusCount += 1;
    }

    rowsByUser.set(scored.userId, row);
  }

  return [...rowsByUser.values()].sort(compareLeaderboardRows);
}

function emptyLeaderboardRow(userId: string): LeaderboardRow {
  return {
    userId,
    points: 0,
    soloCount: 0,
    exactCount: 0,
    outcomeCount: 0,
    closestCount: 0,
    decisionBonusCount: 0,
    matchesScored: 0
  };
}

function compareLeaderboardRows(left: LeaderboardRow, right: LeaderboardRow): number {
  return (
    right.points - left.points ||
    right.soloCount - left.soloCount ||
    right.exactCount - left.exactCount ||
    right.outcomeCount - left.outcomeCount ||
    right.closestCount - left.closestCount ||
    left.userId.localeCompare(right.userId)
  );
}

function outcomeForScore(homeScore: number, awayScore: number): MatchOutcome {
  if (homeScore > awayScore) {
    return "home";
  }

  if (awayScore > homeScore) {
    return "away";
  }

  return "draw";
}

function isKnockoutResult(
  result: MatchResult
): result is MatchResult & { decisionMethod: DecisionMethod } {
  return (
    result.decisionMethod === "regular" ||
    result.decisionMethod === "extra_time" ||
    result.decisionMethod === "penalties"
  );
}

function scoreLayer(
  homeScore: number | null | undefined,
  awayScore: number | null | undefined,
  fallback?: Pick<MatchResult, "homeScore" | "awayScore">
): Pick<MatchResult, "homeScore" | "awayScore"> | undefined {
  if (
    homeScore !== null &&
    homeScore !== undefined &&
    awayScore !== null &&
    awayScore !== undefined
  ) {
    return { homeScore, awayScore };
  }

  if (fallback) {
    return { homeScore: fallback.homeScore, awayScore: fallback.awayScore };
  }

  return undefined;
}

function predictionScoreRow(
  prediction: ScorePrediction,
  score: Pick<MatchResult, "homeScore" | "awayScore">
) {
  return {
    userId: prediction.userId,
    matchId: prediction.matchId,
    homeScore: prediction.homeScore,
    awayScore: prediction.awayScore,
    distance:
      Math.abs(prediction.homeScore - score.homeScore) +
      Math.abs(prediction.awayScore - score.awayScore),
    totalGoalsDistance: Math.abs(
      prediction.homeScore + prediction.awayScore - score.homeScore - score.awayScore
    ),
    outcome: outcomeForScore(prediction.homeScore, prediction.awayScore),
    predictedDecisionMethod: prediction.decisionMethod ?? null,
    isExact:
      prediction.homeScore === score.homeScore &&
      prediction.awayScore === score.awayScore
  };
}

function isExactScore(
  row: ReturnType<typeof predictionScoreRow>,
  score: Pick<MatchResult, "homeScore" | "awayScore">
): boolean {
  return row.homeScore === score.homeScore && row.awayScore === score.awayScore;
}

interface ClosestMetric {
  distance: number;
  totalGoalsDistance: number;
}

function minClosestMetric(rows: ClosestMetric[]): ClosestMetric | undefined {
  if (rows.length === 0) {
    return undefined;
  }

  return rows.reduce((best, row) => (compareClosestMetric(row, best) < 0 ? row : best));
}

function isClosest(row: ClosestMetric, closestMetric: ClosestMetric): boolean {
  return (
    row.distance === closestMetric.distance &&
    row.totalGoalsDistance === closestMetric.totalGoalsDistance
  );
}

function compareClosestMetric(left: ClosestMetric, right: ClosestMetric): number {
  return left.distance - right.distance || left.totalGoalsDistance - right.totalGoalsDistance;
}
