import type { LeaderboardRow } from "../scoring/scoring.js";

export interface CreateLeaderboardDashboardMessageOptions {
  rows: LeaderboardRow[];
  displayNames?: ReadonlyMap<string, string>;
  updatedAt: Date;
  timeZone: string;
}

export interface LeaderboardDashboardMessage {
  content: string;
  embeds: [];
}

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

export function createLeaderboardDashboardMessage(
  options: CreateLeaderboardDashboardMessageOptions
): LeaderboardDashboardMessage {
  return {
    content: [
      "Copanalhas Leaderboard",
      `Updated: ${formatDashboardTimestamp(options.updatedAt, options.timeZone)}`,
      "```text",
      ...formatDashboardRows(options.rows, options.displayNames ?? new Map()),
      "```"
    ].join("\n"),
    embeds: []
  };
}

function formatDashboardRows(
  rows: LeaderboardRow[],
  displayNames: ReadonlyMap<string, string>
): string[] {
  if (rows.length === 0) {
    return ["No scored matches yet."];
  }

  return [
    "#  Player               Pts Exact Close Matches",
    ...rows.map((row, index) =>
      [
        String(rankForRow(rows, index)).padEnd(2),
        playerName(row, displayNames).padEnd(18),
        row.points.toString().padStart(3),
        row.exactCount.toString().padStart(5),
        row.closestCount.toString().padStart(5),
        row.matchesScored.toString().padStart(7)
      ].join(" ")
    )
  ];
}

function rankForRow(rows: LeaderboardRow[], index: number): number {
  if (index === 0 || rows[index]?.points !== rows[index - 1]?.points) {
    return index + 1;
  }

  return rankForRow(rows, index - 1);
}

function playerName(row: LeaderboardRow, displayNames: ReadonlyMap<string, string>): string {
  const name = displayNames.get(row.userId) ?? row.userId;

  return name.length > 18 ? `${name.slice(0, 17)}.` : name;
}

function points(value: number): string {
  return `${value} ${value === 1 ? "pt" : "pts"}`;
}

function count(value: number, singular: string, plural: string): string {
  return `${value} ${value === 1 ? singular : plural}`;
}

function formatDashboardTimestamp(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZoneName: "short"
  }).formatToParts(date);

  return `${part(parts, "year")}-${part(parts, "month")}-${part(parts, "day")} ${part(
    parts,
    "hour"
  )}:${part(parts, "minute")} ${part(parts, "timeZoneName")}`;
}

function part(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((candidate) => candidate.type === type)?.value ?? "";
}
