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
  description?: string;
  footer?: {
    text: string;
  };
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
    content: [
      "World Cup 2026 Group Standings",
      `Updated: ${updatedText}`,
      dashboard.label,
      renderDashboardTable(dashboard.groups, standingsByGroup),
      "Columns: TEAM PTS GD"
    ].join("\n"),
    embeds: []
  }));
}

function renderDashboardTable(
  groups: readonly string[],
  standingsByGroup: ReadonlyMap<string, GroupStandings>
): string {
  const bands = chunk(groups, 3).flatMap((groupBand, index) => {
    const band = renderGroupBand(
      groupBand.map((group) => {
        const standings = standingsByGroup.get(group);

        if (!standings) {
          throw new Error(`Missing standings data for Group ${group}.`);
        }

        return standings;
      })
    );

    return index === 0 ? band : band.slice(1);
  });

  return ["```text", ...bands, "```"].join("\n");
}

function renderGroupBand(groups: readonly GroupStandings[]): string[] {
  return [
    border(groups.length),
    cells(groups.map((group) => `GROUP ${group.group}`)),
    border(groups.length),
    ...[0, 1, 2, 3].map((rowIndex) =>
      cells(groups.map((group) => formatStandingRow(group.rows[rowIndex])))
    ),
    border(groups.length)
  ];
}

function formatStandingRow(row: GroupStandingRow | undefined): string {
  if (!row) {
    return "";
  }

  return `${row.teamCode} ${row.points.toString().padStart(2)} ${formatGoalDifference(
    row.goalDifference
  ).padStart(3)}`;
}

function cells(values: readonly string[]): string {
  return `| ${values.map((value) => value.padEnd(12)).join(" | ")} |`;
}

function border(columnCount: number): string {
  return Array.from({ length: columnCount }, () => "+--------------").join("") + "+";
}

function chunk(values: readonly string[], size: number): string[][] {
  const chunks: string[][] = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}

function formatGoalDifference(goalDifference: number): string {
  return goalDifference > 0 ? `+${goalDifference}` : goalDifference.toString();
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
