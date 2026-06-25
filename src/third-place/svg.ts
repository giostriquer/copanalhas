import { FOOTBALL_DATA_ATTRIBUTION, STANDINGS_DASHBOARD_TITLE } from "../standings/format.js";
import { flagAssetForTeamCode } from "../standings/flag-assets.js";
import { formatTeamName } from "../worldcup/team-display.js";
import type { ThirdPlaceStandingRow, ThirdPlaceStandings } from "./standings.js";

export interface RenderThirdPlaceDashboardSvgOptions {
  standings: ThirdPlaceStandings;
  generatedAtLabel: string;
}

const width = 1500;
const height = 900;
const margin = 44;
const headerHeight = 124;
const font = "Inter, Arial, sans-serif";
const brazilYellow = "#FFDF00";
const brazilBlue = "#002776";
const brazilPanelBlue = "#001f5c";
const brazilGreen = "#009C3B";
const panelStroke = "#1e64d1";
const flagWidth = 27;
const flagHeight = 19;
const tableX = margin + 22;
const tableY = headerHeight + 130;
const tableWidth = width - margin * 2 - 44;
const rowHeight = 48;

export function renderThirdPlaceDashboardSvg(
  options: RenderThirdPlaceDashboardSvgOptions
): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeAttribute(`${STANDINGS_DASHBOARD_TITLE} - Melhores terceiros`)}">`,
    `<rect width="100%" height="100%" fill="${brazilBlue}"/>`,
    `<rect x="0" y="0" width="100%" height="${headerHeight}" fill="${brazilYellow}"/>`,
    renderBrazilFlag(margin, 28, 52, 34),
    text(STANDINGS_DASHBOARD_TITLE, margin + 68, 56, 38, brazilBlue, 900),
    text("Melhores terceiros", margin + 68, 88, 17, brazilBlue, 800),
    text(`Atualizado: ${options.generatedAtLabel}`, width - margin, 58, 15, brazilBlue, 800, "end"),
    text("8 avançam para a Rodada de 32", width - margin, 88, 15, brazilBlue, 800, "end"),
    renderLegend(width - margin - 438, headerHeight + 37),
    renderTable(options.standings),
    text(FOOTBALL_DATA_ATTRIBUTION, width - margin, height - 26, 12, "#bfdbfe", 750, "end"),
    "</svg>"
  ].join("");
}

function renderTable(standings: ThirdPlaceStandings): string {
  const panelY = headerHeight + 42;
  const panelHeight = height - panelY - 70;

  return [
    `<g data-third-place-dashboard-status="${standings.status}">`,
    `<rect x="${margin}" y="${panelY}" width="${width - margin * 2}" height="${panelHeight}" rx="8" fill="${brazilPanelBlue}" stroke="${panelStroke}"/>`,
    `<rect x="${margin}" y="${panelY}" width="6" height="${panelHeight}" rx="3" fill="${brazilGreen}"/>`,
    text("Classificação dos terceiros colocados", margin + 24, panelY + 34, 24, "#ffffff", 900),
    text(statusDescription(standings), width - margin - 24, panelY + 34, 13, "#bfdbfe", 850, "end"),
    ...renderColumnHeaders(tableX, tableY - 24),
    ...standings.rows.map((row, index) =>
      renderThirdPlaceRow(row, tableX, tableY + 26 + index * rowHeight, index)
    ),
    "</g>"
  ].join("");
}

function renderColumnHeaders(x: number, y: number): string[] {
  const cols = columnPositions(x);

  return [
    text("#", cols.rank, y, 12, "#93c5fd", 900, "middle"),
    text("Grupo", cols.group, y, 12, "#93c5fd", 900, "middle"),
    text("Seleção", cols.team, y, 12, "#93c5fd", 900),
    text("Pts", cols.points, y, 12, "#93c5fd", 900, "middle"),
    text("J", cols.played, y, 12, "#93c5fd", 900, "middle"),
    text("V", cols.wins, y, 12, "#93c5fd", 900, "middle"),
    text("E", cols.draws, y, 12, "#93c5fd", 900, "middle"),
    text("D", cols.losses, y, 12, "#93c5fd", 900, "middle"),
    text("GP", cols.goalsFor, y, 12, "#93c5fd", 900, "middle"),
    text("GC", cols.goalsAgainst, y, 12, "#93c5fd", 900, "middle"),
    text("SG", cols.goalDifference, y, 12, "#93c5fd", 900, "middle"),
    text("Status", cols.status, y, 12, "#93c5fd", 900, "middle"),
    `<line x1="${x}" y1="${y + 16}" x2="${x + tableWidth}" y2="${y + 16}" stroke="#1d4ed8"/>`
  ];
}

function renderThirdPlaceRow(
  row: ThirdPlaceStandingRow,
  x: number,
  y: number,
  index: number
): string {
  const rowFill = index % 2 === 0 ? "#00358f" : "#003077";
  const cols = columnPositions(x);
  const rowTop = y - 28;
  const rowCenterY = rowTop + rowHeight / 2;
  const textY = rowCenterY + 6;
  const flagY = rowCenterY - flagHeight / 2;
  const state = stateStyle(row.qualificationState);

  return [
    `<g data-third-place-row="${row.thirdPlaceRank}" data-third-place-state="${row.qualificationState}" data-team-code="${escapeAttribute(row.teamCode)}">`,
    `<rect x="${x}" y="${rowTop}" width="${tableWidth}" height="${rowHeight - 6}" rx="7" fill="${rowFill}"/>`,
    `<rect x="${x}" y="${rowTop}" width="6" height="${rowHeight - 6}" rx="3" fill="${state.accent}"/>`,
    text(String(row.thirdPlaceRank), cols.rank, textY, 15, brazilYellow, 900, "middle"),
    text(row.group, cols.group, textY, 14, "#dbeafe", 900, "middle"),
    renderFlagImage(row.teamCode, cols.team - 38, flagY),
    text(truncate(formatTeamName({ code: row.teamCode, name: row.teamName }), 28), cols.team, textY, 15, "#f8fafc", 900),
    text(String(row.points), cols.points, textY, 17, "#ffffff", 900, "middle"),
    text(String(row.played), cols.played, textY, 14, "#dbeafe", 850, "middle"),
    text(String(row.wins), cols.wins, textY, 14, "#dbeafe", 850, "middle"),
    text(String(row.draws), cols.draws, textY, 14, "#dbeafe", 850, "middle"),
    text(String(row.losses), cols.losses, textY, 14, "#dbeafe", 850, "middle"),
    text(String(row.goalsFor), cols.goalsFor, textY, 14, "#dbeafe", 850, "middle"),
    text(String(row.goalsAgainst), cols.goalsAgainst, textY, 14, "#dbeafe", 850, "middle"),
    text(formatGoalDifference(row.goalDifference), cols.goalDifference, textY, 14, "#dbeafe", 850, "middle"),
    renderStatusPill(
      row.qualificationState,
      state.label,
      cols.status,
      rowCenterY,
      state.accent,
      state.fill,
      state.text
    ),
    "</g>"
  ].join("");
}

interface ColumnPositions {
  rank: number;
  group: number;
  team: number;
  points: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  status: number;
}

function columnPositions(x: number): ColumnPositions {
  return {
    rank: x + 24,
    group: x + 82,
    team: x + 156,
    points: x + 704,
    played: x + 792,
    wins: x + 856,
    draws: x + 918,
    losses: x + 980,
    goalsFor: x + 1054,
    goalsAgainst: x + 1130,
    goalDifference: x + 1210,
    status: x + 1312
  };
}

function renderLegend(x: number, y: number): string {
  return [
    `<g data-third-place-legend="true">`,
    legendItem("Avançando", x, y, "#22c55e"),
    legendItem("No corte", x + 148, y, "#facc15"),
    legendItem("Fora", x + 280, y, "#ef4444"),
    "</g>"
  ].join("");
}

function legendItem(label: string, x: number, y: number, color: string): string {
  return [
    `<rect x="${x}" y="${y - 13}" width="16" height="16" rx="4" fill="${color}"/>`,
    text(label, x + 24, y, 12, "#dbeafe", 850)
  ].join("");
}

function renderStatusPill(
  state: ThirdPlaceStandingRow["qualificationState"],
  label: string,
  centerX: number,
  centerY: number,
  stroke: string,
  fill: string,
  color: string
): string {
  const pillWidth = 104;
  const pillHeight = 25;

  return [
    `<rect data-third-place-status-pill="${escapeAttribute(state)}" x="${centerX - pillWidth / 2}" y="${centerY - pillHeight / 2}" width="${pillWidth}" height="${pillHeight}" rx="12.5" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`,
    text(label, centerX, centerY + 5, 12, color, 900, "middle")
  ].join("");
}

function stateStyle(state: ThirdPlaceStandingRow["qualificationState"]): {
  accent: string;
  fill: string;
  text: string;
  label: string;
} {
  if (state === "advancing") {
    return { accent: "#22c55e", fill: "#052e16", text: "#bbf7d0", label: "Avançando" };
  }

  if (state === "cutoff") {
    return { accent: "#facc15", fill: "#422006", text: "#fde68a", label: "No corte" };
  }

  return { accent: "#ef4444", fill: "#450a0a", text: "#fecaca", label: "Fora" };
}

function statusDescription(standings: ThirdPlaceStandings): string {
  return standings.status === "needs-manual-tiebreaker"
    ? "Limite precisa de desempate manual"
    : "Ordenação FIFA resolvida";
}

function renderBrazilFlag(x: number, y: number, flagWidth: number, flagHeight: number): string {
  const centerX = x + flagWidth / 2;
  const centerY = y + flagHeight / 2;

  return [
    `<g role="img" aria-label="Bandeira do Brasil">`,
    `<rect x="${x}" y="${y}" width="${flagWidth}" height="${flagHeight}" rx="5" fill="${brazilGreen}"/>`,
    `<polygon points="${centerX},${y + 4} ${x + flagWidth - 5},${centerY} ${centerX},${y + flagHeight - 4} ${x + 5},${centerY}" fill="${brazilYellow}"/>`,
    `<circle cx="${centerX}" cy="${centerY}" r="8" fill="${brazilBlue}"/>`,
    `</g>`
  ].join("");
}

function renderFlagImage(teamCode: string, x: number, y: number): string {
  const asset = flagAssetForTeamCode(teamCode);

  if (!asset) {
    return "";
  }

  const clipId = `third-place-flag-${escapeAttribute(teamCode)}-${x}-${y}`;

  return [
    `<g data-flag-team-code="${escapeAttribute(teamCode)}" data-flag-asset="${escapeAttribute(asset.fileName)}">`,
    `<clipPath id="${clipId}"><rect x="${x}" y="${y}" width="${flagWidth}" height="${flagHeight}" rx="2"/></clipPath>`,
    `<image x="${x}" y="${y}" width="${flagWidth}" height="${flagHeight}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})" href="${asset.href}" xlink:href="${asset.href}"/>`,
    `<rect x="${x}" y="${y}" width="${flagWidth}" height="${flagHeight}" rx="2" fill="none" stroke="#d1d7df" stroke-width="0.6"/>`,
    "</g>"
  ].join("");
}

function formatGoalDifference(goalDifference: number): string {
  return goalDifference > 0 ? `+${goalDifference}` : String(goalDifference);
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
