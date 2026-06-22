import type { Buffer } from "node:buffer";

import type { LeaderboardRow } from "../scoring/scoring.js";

export interface CreateLeaderboardDashboardMessageOptions {
  rows: LeaderboardRow[];
  displayNames?: ReadonlyMap<string, string>;
  updatedAt: Date;
  timeZone: string;
  renderError?: string;
}

export interface LeaderboardDashboardMessage {
  content: string;
  embeds: [];
  files: Array<{ attachment: Buffer; name: string }>;
}

export const LEADERBOARD_DASHBOARD_TITLE = "Ranking Copanalhas";
export const LEADERBOARD_ATTACHMENT_NAME = "copanalhas-leaderboard.png";
export const FOOTBALL_DATA_ATTRIBUTION = "Football data provided by the Football-Data.org API.";

const rulesLines = [
  "Como funciona",
  "- Envie seu palpite pelo botão do jogo do dia; você pode editar até 30 min antes da partida.",
  "- Se só uma pessoa acertar o placar exato, ela ganha 5 pts solo.",
  "- Se mais de uma pessoa acertar o placar exato, cada uma ganha 3 pts exato.",
  "- Se ninguém acertar o placar exato, quem acertar o vencedor ou empate ganha 2 pts resultado.",
  "- O ponto de mais próximo só vale quando ninguém acerta o placar exato nem o vencedor/empate.",
  "- Nesse caso, ganha 1 pt quem tiver a menor soma de diferenças nos gols dos dois times; se empatar, desempata pelo total de gols mais próximo.",
  "- Em empate na pontuação, desempata por solo, exatos, resultados, mais próximos e depois ID do jogador.",
  "",
  "Premiação",
  "- 1000 (da pra aumentar se alguem quiser contribuir)",
  "- Primeiro lugar = 60%",
  "- Segundo lugar = 30%",
  "- Terceiro lugar = 10%",
  "",
  FOOTBALL_DATA_ATTRIBUTION
];

export function formatLeaderboard(
  rows: LeaderboardRow[],
  displayNames: ReadonlyMap<string, string> = new Map()
): string {
  if (rows.length === 0) {
    return [LEADERBOARD_DASHBOARD_TITLE, "Ainda não há resultados pontuados.", "", ...rulesLines].join("\n");
  }

  const lines = [LEADERBOARD_DASHBOARD_TITLE];
  let previousRow: LeaderboardRow | undefined;
  let previousRank = 0;

  rows.forEach((row, index) => {
    const rank =
      previousRow && sameLeaderboardRank(row, previousRow) ? previousRank : index + 1;
    previousRow = row;
    previousRank = rank;

    lines.push(
      `${rank}. ${displayNameForRow(row, displayNames)} - ${points(row.points)} (${count(
        row.soloCount,
        "solo",
        "solos"
      )}, ${count(
        row.exactCount,
        "exato",
        "exatos"
      )}, ${count(row.outcomeCount, "resultado", "resultados")}, ${count(
        row.closestCount,
        "mais próximo",
        "mais próximos"
      )}, ${count(row.matchesScored, "partida", "partidas")})`
    );
  });

  return [...lines, "", ...rulesLines].join("\n");
}

export function createLeaderboardDashboardMessage(
  options: CreateLeaderboardDashboardMessageOptions,
  png: Buffer | null
): LeaderboardDashboardMessage {
  const timestamp = formatLeaderboardDashboardTimestamp(options.updatedAt, options.timeZone);

  if (png) {
    return {
      content: [
        `**${LEADERBOARD_DASHBOARD_TITLE}**`,
        `Atualizado: ${timestamp}`,
        "Imagem atualizada.",
        FOOTBALL_DATA_ATTRIBUTION
      ].join("\n"),
      embeds: [],
      files: [{ attachment: png, name: LEADERBOARD_ATTACHMENT_NAME }]
    };
  }

  return {
    content: [
      `**${LEADERBOARD_DASHBOARD_TITLE}**`,
      `Atualizado: ${timestamp}`,
      options.renderError
        ? `Dashboard image render failed: ${options.renderError}`
        : "Imagem indisponivel no momento; usando fallback de texto.",
      "```text",
      ...formatDashboardRows(options.rows, options.displayNames ?? new Map()),
      "```",
      "",
      ...rulesLines
    ].join("\n"),
    embeds: [],
    files: []
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
    "#  Pts Solo Exato Resul Perto Jogos  Jogador",
    ...rows.map((row, index) =>
      [
        String(rankForRow(rows, index)).padEnd(2),
        row.points.toString().padStart(3),
        row.soloCount.toString().padStart(4),
        row.exactCount.toString().padStart(5),
        row.outcomeCount.toString().padStart(5),
        row.closestCount.toString().padStart(5),
        row.matchesScored.toString().padStart(5)
      ].join(" ") + `  ${playerName(row, displayNames)}`
    )
  ];
}

function rankForRow(rows: LeaderboardRow[], index: number): number {
  const row = rows[index];
  const previous = rows[index - 1];

  if (!row || !previous || !sameLeaderboardRank(row, previous)) {
    return index + 1;
  }

  return rankForRow(rows, index - 1);
}

function sameLeaderboardRank(left: LeaderboardRow, right: LeaderboardRow): boolean {
  return (
    left.points === right.points &&
    left.soloCount === right.soloCount &&
    left.exactCount === right.exactCount &&
    left.outcomeCount === right.outcomeCount &&
    left.closestCount === right.closestCount
  );
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

export function formatLeaderboardDashboardTimestamp(date: Date, timeZone: string): string {
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
