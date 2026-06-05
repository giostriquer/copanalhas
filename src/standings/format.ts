import type { GroupStandingRow, GroupStandings } from "./standings.js";

export type StandingsPostKey = "groups_a_f" | "groups_g_l";

export interface CreateStandingsDashboardMessagesOptions {
  standings: readonly GroupStandings[];
  updatedAt: Date;
  timeZone: string;
}

export interface StandingsDashboardMessage {
  key: StandingsPostKey;
  content: string;
  embeds: StandingsDashboardEmbed[];
}

export interface StandingsDashboardEmbed {
  title: string;
  description: string;
}

const dashboardGroups: Array<{ key: StandingsPostKey; label: string; groups: string[] }> = [
  { key: "groups_a_f", label: "Groups A-F", groups: ["A", "B", "C", "D", "E", "F"] },
  { key: "groups_g_l", label: "Groups G-L", groups: ["G", "H", "I", "J", "K", "L"] }
];

export function createStandingsDashboardMessages(
  options: CreateStandingsDashboardMessagesOptions
): StandingsDashboardMessage[] {
  const standingsByGroup = new Map(options.standings.map((standing) => [standing.group, standing]));
  const updatedText = formatDashboardTimestamp(options.updatedAt, options.timeZone);

  return dashboardGroups.map((dashboard) => ({
    key: dashboard.key,
    content: ["World Cup 2026 Group Standings", dashboard.label, `Updated: ${updatedText}`].join(
      "\n"
    ),
    embeds: dashboard.groups.map((group) => {
      const standings = standingsByGroup.get(group);

      if (!standings) {
        throw new Error(`Missing standings data for Group ${group}.`);
      }

      return {
        title: `Group ${group}`,
        description: renderGroupTable(standings.rows)
      };
    })
  }));
}

function renderGroupTable(rows: readonly GroupStandingRow[]): string {
  return [
    "```text",
    "# Team              P W D L GF GA GD Pts",
    ...rows.map(formatStandingRow),
    "```"
  ].join("\n");
}

function formatStandingRow(row: GroupStandingRow): string {
  return [
    row.rank.toString(),
    truncate(row.teamName, 16).padEnd(16),
    row.played.toString(),
    row.wins.toString(),
    row.draws.toString(),
    row.losses.toString(),
    row.goalsFor.toString().padStart(2),
    row.goalsAgainst.toString().padStart(2),
    row.goalDifference.toString().padStart(2),
    row.points.toString().padStart(3)
  ].join(" ");
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return value.slice(0, maxLength - 1) + ".";
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
