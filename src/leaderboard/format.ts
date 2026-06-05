import type { LeaderboardRow } from "../scoring/scoring.js";

export function formatLeaderboard(
  rows: LeaderboardRow[],
  displayNames: ReadonlyMap<string, string> = new Map()
): string {
  if (rows.length === 0) {
    return "No leaderboard results yet.";
  }

  const lines = ["Copanalhas Leaderboard"];
  let previousPoints: number | undefined;
  let previousRank = 0;

  rows.forEach((row, index) => {
    const rank = previousPoints === row.points ? previousRank : index + 1;
    previousPoints = row.points;
    previousRank = rank;

    lines.push(
      `${rank}. ${displayNames.get(row.userId) ?? row.userId} - ${points(row.points)} (${count(
        row.exactCount,
        "exact",
        "exact"
      )}, ${count(row.closestCount, "closest", "closest")}, ${count(
        row.matchesScored,
        "match",
        "matches"
      )})`
    );
  });

  return lines.join("\n");
}

function points(value: number): string {
  return `${value} ${value === 1 ? "pt" : "pts"}`;
}

function count(value: number, singular: string, plural: string): string {
  return `${value} ${value === 1 ? singular : plural}`;
}
