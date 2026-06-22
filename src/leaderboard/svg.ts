import type { LeaderboardRow } from "../scoring/scoring.js";

import { FOOTBALL_DATA_ATTRIBUTION, LEADERBOARD_DASHBOARD_TITLE } from "./format.js";

export interface LeaderboardDashboardSvgInput {
  rows: readonly LeaderboardRow[];
  displayNames?: ReadonlyMap<string, string>;
  generatedAtLabel: string;
}

const width = 1500;
const margin = 44;
const headerHeight = 124;
const tableTop = 190;
const rowHeight = 48;
const minHeight = 720;
const footerHeight = 156;
const font = "Inter, Arial, sans-serif";
const brazilYellow = "#FFDF00";
const brazilBlue = "#002776";
const brazilPanelBlue = "#001f5c";
const brazilGreen = "#009C3B";
const panelStroke = "#1e64d1";
const tableWidth = width - margin * 2;
const columns = {
  rank: margin + 46,
  player: margin + 118,
  points: margin + 740,
  solo: margin + 865,
  exact: margin + 990,
  outcome: margin + 1135,
  closest: margin + 1270,
  matches: margin + 1380
};

export function renderLeaderboardDashboardSvg(input: LeaderboardDashboardSvgInput): string {
  const displayNames = input.displayNames ?? new Map();
  const tableRowCount = Math.max(1, input.rows.length);
  const height = Math.max(minHeight, tableTop + 62 + tableRowCount * rowHeight + footerHeight);
  const footerTop = height - footerHeight + 34;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeAttribute(LEADERBOARD_DASHBOARD_TITLE)}">`,
    `<rect width="100%" height="100%" fill="${brazilBlue}"/>`,
    `<rect x="0" y="0" width="100%" height="${headerHeight}" fill="${brazilYellow}"/>`,
    text(LEADERBOARD_DASHBOARD_TITLE, margin, 56, 38, brazilBlue, 900),
    text("Tabela geral", margin, 88, 17, brazilBlue, 800),
    text(`Atualizado: ${input.generatedAtLabel}`, width - margin, 58, 15, brazilBlue, 800, "end"),
    text("Solo 5 pts | Exato 3 pts | Resultado 2 pts | Perto 1 pt", width - margin, 88, 15, brazilBlue, 800, "end"),
    `<rect x="${margin}" y="${tableTop - 44}" width="${tableWidth}" height="${height - tableTop - footerHeight + 70}" rx="8" fill="${brazilPanelBlue}" stroke="${panelStroke}"/>`,
    ...renderHeader(tableTop),
    ...renderRows(input.rows, displayNames, tableTop + 56),
    ...renderFooter(footerTop),
    "</svg>"
  ].join("");
}

function renderHeader(y: number): string[] {
  return [
    text("#", columns.rank, y, 13, "#93c5fd", 900, "middle"),
    text("Jogador", columns.player, y, 13, "#93c5fd", 900),
    text("Pts", columns.points, y, 13, "#93c5fd", 900, "middle"),
    text("Solo", columns.solo, y, 13, "#93c5fd", 900, "middle"),
    text("Exato", columns.exact, y, 13, "#93c5fd", 900, "middle"),
    text("Resultado", columns.outcome, y, 13, "#93c5fd", 900, "middle"),
    text("Perto", columns.closest, y, 13, "#93c5fd", 900, "middle"),
    text("Jogos", columns.matches, y, 13, "#93c5fd", 900, "middle"),
    `<line x1="${margin + 22}" y1="${y + 18}" x2="${width - margin - 22}" y2="${y + 18}" stroke="#1d4ed8"/>`
  ];
}

function renderRows(
  rows: readonly LeaderboardRow[],
  displayNames: ReadonlyMap<string, string>,
  startY: number
): string[] {
  if (rows.length === 0) {
    return [
      `<rect x="${margin + 22}" y="${startY - 26}" width="${tableWidth - 44}" height="42" rx="6" fill="#00358f"/>`,
      text("Ainda não há partidas pontuadas.", margin + 42, startY, 18, "#f8fafc", 800)
    ];
  }

  return rows.flatMap((row, index) => {
    const y = startY + index * rowHeight;
    const fill = index % 2 === 0 ? "#00358f" : "#003077";
    const accent = index === 0 ? brazilYellow : index === 1 ? brazilGreen : index === 2 ? "#60a5fa" : "#1d4ed8";

    return [
      `<rect x="${margin + 22}" y="${y - 28}" width="${tableWidth - 44}" height="40" rx="6" fill="${fill}"/>`,
      `<rect x="${margin + 22}" y="${y - 28}" width="6" height="40" rx="3" fill="${accent}"/>`,
      text(String(rankForRow(rows, index)), columns.rank, y, 18, brazilYellow, 900, "middle"),
      text(truncate(playerName(row, displayNames), 52), columns.player, y, 18, "#f8fafc", 900),
      text(String(row.points), columns.points, y, 19, "#f8fafc", 900, "middle"),
      text(String(row.soloCount), columns.solo, y, 17, "#dbeafe", 850, "middle"),
      text(String(row.exactCount), columns.exact, y, 17, "#dbeafe", 850, "middle"),
      text(String(row.outcomeCount), columns.outcome, y, 17, "#dbeafe", 850, "middle"),
      text(String(row.closestCount), columns.closest, y, 17, "#dbeafe", 850, "middle"),
      text(String(row.matchesScored), columns.matches, y, 17, "#dbeafe", 850, "middle")
    ];
  });
}

function renderFooter(y: number): string[] {
  return [
    `<rect x="${margin}" y="${y - 28}" width="${tableWidth}" height="112" rx="8" fill="#001847" stroke="${panelStroke}"/>`,
    text("Premiação: 1k | 1º lugar 60% | 2º lugar 30% | 3º lugar 10%", margin + 26, y, 17, "#f8fafc", 850),
    text("Desempate: pontos, solo, exatos, resultados, perto e ID do jogador.", margin + 26, y + 28, 13, "#bfdbfe", 750),
    text("PS: Se o anguish ganhar eu darei unblock nele como premiação no lugar dos 60%.", margin + 26, y + 56, 13, brazilYellow, 850),
    text(FOOTBALL_DATA_ATTRIBUTION, width - margin - 26, y + 76, 13, "#bfdbfe", 750, "end")
  ];
}

function rankForRow(rows: readonly LeaderboardRow[], index: number): number {
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
  return normalizeDisplayName(displayNames.get(row.userId)) || row.userId;
}

function normalizeDisplayName(name: string | undefined): string {
  return (name ?? "").replace(/\s+/gu, " ").trim();
}

function text(
  value: string,
  x: number,
  y: number,
  size: number,
  color: string,
  weight: number,
  anchor: "start" | "end" | "middle" = "start"
): string {
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${font}" font-size="${size}" font-weight="${weight}" fill="${color}">${escapeText(value)}</text>`;
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 1))}.`;
}

function escapeText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeAttribute(value: string): string {
  return escapeText(value).replaceAll("\"", "&quot;");
}
