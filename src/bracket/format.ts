import type { Buffer } from "node:buffer";

import type { BracketState } from "./types.js";

export const BRACKET_DASHBOARD_TITLE = "World Cup 2026 Bracket";
export const BRACKET_ATTACHMENT_NAME = "copanalhas-bracket.png";
export const FOOTBALL_DATA_ATTRIBUTION = "Football data provided by the Football-Data.org API.";

export interface BracketDashboardMessage {
  content: string;
  embeds: [];
  files: Array<{ attachment: Buffer; name: string }>;
}

export function createBracketDashboardMessage(
  state: BracketState,
  png: Buffer | null
): BracketDashboardMessage {
  const lines = [
    `**${BRACKET_DASHBOARD_TITLE}**`,
    `Status: ${phaseLabel(state)}`,
    ...(state.generatedAtLabel ? [`Updated: ${state.generatedAtLabel}`] : []),
    ...state.notes.map((note) => `- ${note}`),
    "",
    FOOTBALL_DATA_ATTRIBUTION
  ];

  return {
    content: lines.join("\n"),
    embeds: [],
    files: png ? [{ attachment: png, name: BRACKET_ATTACHMENT_NAME }] : []
  };
}

function phaseLabel(state: BracketState): string {
  if (state.phase === "provisional") {
    return "As it stands";
  }

  if (state.phase === "blocked") {
    return "Needs manual tiebreaker review";
  }

  return "Final Round of 32";
}
