import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import {
  FOOTBALL_DATA_ATTRIBUTION,
  STANDINGS_DASHBOARD_TITLE
} from "./format.js";
import type { GroupStandingRow, GroupStandings } from "./standings.js";
import { formatTeamName } from "../worldcup/team-display.js";

export interface RenderStandingsDashboardSvgOptions {
  standings: readonly GroupStandings[];
  groups: readonly string[];
  label: string;
  generatedAtLabel: string;
}

const require = createRequire(import.meta.url);
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
const cardGap = 22;
const cardWidth = (width - margin * 2 - cardGap * 2) / 3;
const cardHeight = 312;
const cardTop = headerHeight + 36;
const rowHeight = 42;
const flagWidth = 25;
const flagHeight = 18;

export function renderStandingsDashboardSvg(
  options: RenderStandingsDashboardSvgOptions
): string {
  const standingsByGroup = new Map(options.standings.map((standing) => [standing.group, standing]));

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeAttribute(`${STANDINGS_DASHBOARD_TITLE} - ${options.label}`)}">`,
    `<rect width="100%" height="100%" fill="${brazilBlue}"/>`,
    `<rect x="0" y="0" width="100%" height="${headerHeight}" fill="${brazilYellow}"/>`,
    renderBrazilFlag(margin, 28, 52, 34),
    text(STANDINGS_DASHBOARD_TITLE, margin + 68, 56, 38, brazilBlue, 900),
    text(options.label, margin + 68, 88, 17, brazilBlue, 800),
    text(`Atualizado: ${options.generatedAtLabel}`, width - margin, 58, 15, brazilBlue, 800, "end"),
    text("Pts J V E D GP GC SG", width - margin, 88, 15, brazilBlue, 800, "end"),
    ...options.groups.map((group, index) => {
      const standing = standingsByGroup.get(group);

      if (!standing) {
        throw new Error(`Missing standings data for Group ${group}.`);
      }

      return renderGroupCard(standing, margin + (index % 3) * (cardWidth + cardGap), cardTop + Math.floor(index / 3) * (cardHeight + cardGap));
    }),
    text(FOOTBALL_DATA_ATTRIBUTION, width - margin, height - 26, 12, "#bfdbfe", 750, "end"),
    "</svg>"
  ].join("");
}

function renderGroupCard(group: GroupStandings, x: number, y: number): string {
  return [
    `<g data-standing-group="${escapeAttribute(group.group)}">`,
    `<rect x="${x}" y="${y}" width="${cardWidth}" height="${cardHeight}" rx="8" fill="${brazilPanelBlue}" stroke="${panelStroke}"/>`,
    `<rect x="${x}" y="${y}" width="6" height="${cardHeight}" rx="3" fill="${brazilGreen}"/>`,
    text(`Grupo ${group.group}`, x + 20, y + 32, 22, "#ffffff", 900),
    ...renderColumnHeaders(x, y + 66),
    ...group.rows.slice(0, 4).flatMap((row, index) =>
      renderStandingRow(row, x + 14, y + 104 + index * rowHeight, index)
    ),
    "</g>"
  ].join("");
}

function renderColumnHeaders(x: number, y: number): string[] {
  const cols = columnPositions(x);

  return [
    text("Seleção", cols.team, y, 11, "#93c5fd", 900),
    text("Pts", cols.points, y, 11, "#93c5fd", 900, "middle"),
    text("J", cols.played, y, 11, "#93c5fd", 900, "middle"),
    text("V", cols.wins, y, 11, "#93c5fd", 900, "middle"),
    text("E", cols.draws, y, 11, "#93c5fd", 900, "middle"),
    text("D", cols.losses, y, 11, "#93c5fd", 900, "middle"),
    text("GP", cols.goalsFor, y, 11, "#93c5fd", 900, "middle"),
    text("GC", cols.goalsAgainst, y, 11, "#93c5fd", 900, "middle"),
    text("SG", cols.goalDifference, y, 11, "#93c5fd", 900, "middle"),
    `<line x1="${x + 18}" y1="${y + 14}" x2="${x + cardWidth - 18}" y2="${y + 14}" stroke="#1d4ed8"/>`
  ];
}

function renderStandingRow(
  row: GroupStandingRow,
  x: number,
  y: number,
  index: number
): string[] {
  const rowFill = index % 2 === 0 ? "#00358f" : "#003077";
  const accent = index < 2 ? brazilGreen : index === 2 ? brazilYellow : "#ef4444";
  const cols = columnPositions(x - 14);
  const rowTop = y - 24;
  const rowCenterY = rowTop + 17;
  const textY = rowCenterY + 5;
  const flagY = rowCenterY - flagHeight / 2;

  return [
    `<rect x="${x}" y="${rowTop}" width="${cardWidth - 28}" height="34" rx="6" fill="${rowFill}"/>`,
    `<rect x="${x}" y="${rowTop}" width="5" height="34" rx="2.5" fill="${accent}"/>`,
    text(String(row.rank), x + 20, textY, 12, brazilYellow, 900, "middle"),
    renderFlagImage(row.teamCode, x + 34, flagY),
    text(truncate(formatTeamName({ code: row.teamCode, name: row.teamName }), 18), cols.team, textY, 13, "#f8fafc", 900),
    text(String(row.points), cols.points, textY, 14, "#ffffff", 900, "middle"),
    text(String(row.played), cols.played, textY, 12, "#dbeafe", 850, "middle"),
    text(String(row.wins), cols.wins, textY, 12, "#dbeafe", 850, "middle"),
    text(String(row.draws), cols.draws, textY, 12, "#dbeafe", 850, "middle"),
    text(String(row.losses), cols.losses, textY, 12, "#dbeafe", 850, "middle"),
    text(String(row.goalsFor), cols.goalsFor, textY, 12, "#dbeafe", 850, "middle"),
    text(String(row.goalsAgainst), cols.goalsAgainst, textY, 12, "#dbeafe", 850, "middle"),
    text(formatGoalDifference(row.goalDifference), cols.goalDifference, textY, 12, "#dbeafe", 850, "middle")
  ];
}

interface ColumnPositions {
  team: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

function columnPositions(x: number): ColumnPositions {
  return {
    team: x + 78,
    points: x + 236,
    played: x + 268,
    wins: x + 296,
    draws: x + 324,
    losses: x + 352,
    goalsFor: x + 382,
    goalsAgainst: x + 412,
    goalDifference: x + 442
  };
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

  const clipId = `standings-flag-${escapeAttribute(teamCode)}-${x}-${y}`;

  return [
    `<g data-flag-team-code="${escapeAttribute(teamCode)}" data-flag-asset="${escapeAttribute(asset.fileName)}">`,
    `<clipPath id="${clipId}"><rect x="${x}" y="${y}" width="${flagWidth}" height="${flagHeight}" rx="2"/></clipPath>`,
    `<image x="${x}" y="${y}" width="${flagWidth}" height="${flagHeight}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})" href="${asset.href}" xlink:href="${asset.href}"/>`,
    `<rect x="${x}" y="${y}" width="${flagWidth}" height="${flagHeight}" rx="2" fill="none" stroke="#d1d7df" stroke-width="0.6"/>`,
    "</g>"
  ].join("");
}

function flagAssetForTeamCode(teamCode: string): FlagAsset | undefined {
  const flagCode = flagIconCodeByTeamCode.get(teamCode);

  if (!flagCode) {
    return undefined;
  }

  const cached = flagAssetCache.get(flagCode);

  if (cached) {
    return cached;
  }

  const fileName = `${flagCode}.svg`;
  const sourcePath = join(flagIconsRoot(), "flags", "4x3", fileName);
  const data = readFileSync(sourcePath).toString("base64");
  const asset = {
    fileName,
    href: `data:image/svg+xml;base64,${data}`
  };

  flagAssetCache.set(flagCode, asset);

  return asset;
}

function flagIconsRoot(): string {
  const packageJsonPath = require.resolve("flag-icons/package.json");

  return dirname(packageJsonPath);
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

interface FlagAsset {
  fileName: string;
  href: string;
}

const flagAssetCache = new Map<string, FlagAsset>();

const flagIconCodeByTeamCode = new Map<string, string>([
  ["ALG", "dz"],
  ["ARG", "ar"],
  ["AUS", "au"],
  ["AUT", "at"],
  ["BEL", "be"],
  ["BIH", "ba"],
  ["BRA", "br"],
  ["CAN", "ca"],
  ["CIV", "ci"],
  ["COD", "cd"],
  ["COL", "co"],
  ["CPV", "cv"],
  ["CRO", "hr"],
  ["CUW", "cw"],
  ["CZE", "cz"],
  ["ECU", "ec"],
  ["EGY", "eg"],
  ["ENG", "gb-eng"],
  ["ESP", "es"],
  ["FRA", "fr"],
  ["GER", "de"],
  ["GHA", "gh"],
  ["HAI", "ht"],
  ["IRN", "ir"],
  ["IRQ", "iq"],
  ["JOR", "jo"],
  ["JPN", "jp"],
  ["KOR", "kr"],
  ["KSA", "sa"],
  ["MAR", "ma"],
  ["MEX", "mx"],
  ["NED", "nl"],
  ["NOR", "no"],
  ["NZL", "nz"],
  ["PAN", "pa"],
  ["PAR", "py"],
  ["POR", "pt"],
  ["QAT", "qa"],
  ["RSA", "za"],
  ["SCO", "gb-sct"],
  ["SEN", "sn"],
  ["SUI", "ch"],
  ["SWE", "se"],
  ["TUN", "tn"],
  ["TUR", "tr"],
  ["URU", "uy"],
  ["USA", "us"],
  ["UZB", "uz"]
]);
