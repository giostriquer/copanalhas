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

const leaderboardTitle = "Ranking Copanalhas";
const rulesLines = [
  "Como funciona",
  "- Envie seu palpite pelo botão do jogo do dia; você pode editar até 30 min antes da partida.",
  "- Placar exato vale 3 pts.",
  "- O palpite mais próximo vale 1 pt pela menor soma de diferenças nos gols dos dois times.",
  "- O ponto de mais próximo também vale quando alguém acerta o placar exato; empates recebem a mesma posição."
];

export function formatLeaderboard(
  rows: LeaderboardRow[],
  displayNames: ReadonlyMap<string, string> = new Map()
): string {
  if (rows.length === 0) {
    return [leaderboardTitle, "Ainda não há resultados pontuados.", "", ...rulesLines].join("\n");
  }

  const lines = [leaderboardTitle];
  let previousPoints: number | undefined;
  let previousRank = 0;

  rows.forEach((row, index) => {
    const rank = previousPoints === row.points ? previousRank : index + 1;
    previousPoints = row.points;
    previousRank = rank;

    lines.push(
      `${rank}. ${displayNameForRow(row, displayNames)} - ${points(row.points)} (${count(
        row.exactCount,
        "exato",
        "exatos"
      )}, ${count(row.closestCount, "mais próximo", "mais próximos")}, ${count(
        row.matchesScored,
        "partida",
        "partidas"
      )})`
    );
  });

  return [...lines, "", ...rulesLines].join("\n");
}

export function createLeaderboardDashboardMessage(
  options: CreateLeaderboardDashboardMessageOptions
): LeaderboardDashboardMessage {
  return {
    content: [
      leaderboardTitle,
      `Atualizado: ${formatDashboardTimestamp(options.updatedAt, options.timeZone)}`,
      "```text",
      ...formatDashboardRows(options.rows, options.displayNames ?? new Map()),
      "```",
      "",
      ...rulesLines
    ].join("\n"),
    embeds: []
  };
}

function formatDashboardRows(
  rows: LeaderboardRow[],
  displayNames: ReadonlyMap<string, string>
): string[] {
  if (rows.length === 0) {
    return ["Ainda não há partidas pontuadas."];
  }

  return [
    "#  Pts Exato Perto Jogos  Jogador",
    ...rows.map((row, index) =>
      [
        String(rankForRow(rows, index)).padEnd(2),
        row.points.toString().padStart(3),
        row.exactCount.toString().padStart(5),
        row.closestCount.toString().padStart(5),
        row.matchesScored.toString().padStart(5)
      ].join(" ") + `  ${playerName(row, displayNames)}`
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
  return displayNameForRow(row, displayNames);
}

function displayNameForRow(
  row: LeaderboardRow,
  displayNames: ReadonlyMap<string, string>
): string {
  return normalizeDisplayName(displayNames.get(row.userId)) || row.userId;
}

function normalizeDisplayName(name: string | undefined): string {
  return (name ?? "").replace(/`/gu, "'").replace(/\s+/gu, " ").trim();
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
