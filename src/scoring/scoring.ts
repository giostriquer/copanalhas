export type ScoreAward = "exact" | "closest";

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
      isExact:
        prediction.homeScore === result.homeScore &&
        prediction.awayScore === result.awayScore
    }));

  const closestDistance = minDistance(rows.filter((row) => !row.isExact));

  return rows.map((row) => {
    const awards: ScoreAward[] = [];
    let points = 0;

    if (row.isExact) {
      awards.push("exact");
      points += 3;
    }

    if (!row.isExact && closestDistance !== undefined && row.distance === closestDistance) {
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
    closestCount: 0,
    matchesScored: 0
  };
}

function minDistance(rows: Array<{ distance: number }>): number | undefined {
  if (rows.length === 0) {
    return undefined;
  }

  return Math.min(...rows.map((row) => row.distance));
}
