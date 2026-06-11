export type ScoreAward = "exact" | "outcome" | "closest";
type MatchOutcome = "home" | "away" | "draw";

export interface MatchResult {
  matchId: string;
  homeScore: number;
  awayScore: number;
}

export interface ScorePrediction {
  userId: string;
  matchId: string;
  homeScore: number;
  awayScore: number;
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
  exactCount: number;
  outcomeCount: number;
  closestCount: number;
  matchesScored: number;
}

export function scoreMatch(
  result: MatchResult,
  predictions: ScorePrediction[]
): ScoredPrediction[] {
  const rows = predictions
    .filter((prediction) => prediction.matchId === result.matchId)
    .map((prediction) => ({
      userId: prediction.userId,
      matchId: prediction.matchId,
      distance:
        Math.abs(prediction.homeScore - result.homeScore) +
        Math.abs(prediction.awayScore - result.awayScore),
      outcome: outcomeForScore(prediction.homeScore, prediction.awayScore),
      isExact:
        prediction.homeScore === result.homeScore &&
        prediction.awayScore === result.awayScore
    }));

  const resultOutcome = outcomeForScore(result.homeScore, result.awayScore);
  const exactCount = rows.filter((row) => row.isExact).length;
  const exactPoints = exactCount === 1 ? 3 : 1;
  const outcomeCount =
    exactCount === 0 ? rows.filter((row) => row.outcome === resultOutcome).length : 0;
  const closestDistance = exactCount === 0 && outcomeCount === 0 ? minDistance(rows) : undefined;

  return rows.map((row) => {
    const awards: ScoreAward[] = [];
    let points = 0;

    if (row.isExact) {
      awards.push("exact");
      points += exactPoints;
    }

    if (outcomeCount > 0 && row.outcome === resultOutcome) {
      awards.push("outcome");
      points += 1;
    }

    if (closestDistance !== undefined && row.distance === closestDistance) {
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

    if (scored.awards.includes("exact")) {
      row.exactCount += 1;
    }

    if (scored.awards.includes("outcome")) {
      row.outcomeCount += 1;
    }

    if (scored.awards.includes("closest")) {
      row.closestCount += 1;
    }

    rowsByUser.set(scored.userId, row);
  }

  return [...rowsByUser.values()].sort(
    (left, right) => right.points - left.points || left.userId.localeCompare(right.userId)
  );
}

function emptyLeaderboardRow(userId: string): LeaderboardRow {
  return {
    userId,
    points: 0,
    exactCount: 0,
    outcomeCount: 0,
    closestCount: 0,
    matchesScored: 0
  };
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

function minDistance(rows: Array<{ distance: number }>): number | undefined {
  if (rows.length === 0) {
    return undefined;
  }

  return Math.min(...rows.map((row) => row.distance));
}
