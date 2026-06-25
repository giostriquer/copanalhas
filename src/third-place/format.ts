import type { Buffer } from "node:buffer";

import { FOOTBALL_DATA_ATTRIBUTION, STANDINGS_DASHBOARD_TITLE } from "../standings/format.js";
import { formatCompactTeamName } from "../worldcup/team-display.js";
import type { ThirdPlaceStandingRow, ThirdPlaceStandings } from "./standings.js";

export const THIRD_PLACE_DASHBOARD_TITLE = `${STANDINGS_DASHBOARD_TITLE} - Melhores terceiros`;
export const THIRD_PLACE_ATTACHMENT_NAME = "copanalhas-third-places.png";

export interface ThirdPlaceDashboardMessage {
  content: string;
  embeds: [];
  files: Array<{ attachment: Buffer; name: string }>;
}

export interface CreateThirdPlaceDashboardMessageOptions {
  standings: ThirdPlaceStandings;
  updatedAt: Date;
  timeZone: string;
  png?: Buffer;
  renderError?: string;
}

export function createThirdPlaceDashboardMessage(
  options: CreateThirdPlaceDashboardMessageOptions
): ThirdPlaceDashboardMessage {
  const updatedText = formatDashboardTimestamp(options.updatedAt, options.timeZone);

  if (options.png) {
    return {
      content: [
        `**${THIRD_PLACE_DASHBOARD_TITLE}**`,
        `Atualizado: ${updatedText}`,
        "Verde avança | Amarelo no corte | Vermelho fora",
        FOOTBALL_DATA_ATTRIBUTION
      ].join("\n"),
      embeds: [],
      files: [{ attachment: options.png, name: THIRD_PLACE_ATTACHMENT_NAME }]
    };
  }

  return {
    content: [
      THIRD_PLACE_DASHBOARD_TITLE,
      `Atualizado: ${updatedText}`,
      options.renderError
        ? `Dashboard image render failed: ${options.renderError}`
        : "Imagem indisponivel no momento; usando fallback de texto.",
      renderThirdPlaceFallbackTable(options.standings.rows),
      FOOTBALL_DATA_ATTRIBUTION
    ].join("\n"),
    embeds: [],
    files: []
  };
}

function renderThirdPlaceFallbackTable(rows: readonly ThirdPlaceStandingRow[]): string {
  return [
    "```text",
    " # Grp Team           Pts J V E D GP GC SG  Status",
    ...rows.map(formatRow),
    "```"
  ].join("\n");
}

function formatRow(row: ThirdPlaceStandingRow): string {
  return [
    row.thirdPlaceRank.toString().padStart(2),
    row.group.padEnd(3),
    formatCompactTeamName({ code: row.teamCode, name: row.teamName }, 14).padEnd(14),
    row.points.toString().padStart(3),
    row.played.toString().padStart(1),
    row.wins.toString().padStart(1),
    row.draws.toString().padStart(1),
    row.losses.toString().padStart(1),
    row.goalsFor.toString().padStart(2),
    row.goalsAgainst.toString().padStart(2),
    formatGoalDifference(row.goalDifference).padStart(3),
    statusLabel(row)
  ].join(" ");
}

function statusLabel(row: ThirdPlaceStandingRow): string {
  if (row.qualificationState === "advancing") {
    return "avança";
  }

  if (row.qualificationState === "cutoff") {
    return "no corte";
  }

  return "fora";
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
