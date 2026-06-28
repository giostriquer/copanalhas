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
    ...(state.generatedAtLabel ? [`Atualizado: ${state.generatedAtLabel}`] : []),
    ...state.notes.map((note) => `- ${localizedNote(note)}`),
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
    return "Como está";
  }

  if (state.phase === "blocked") {
    return "Precisa de revisão manual de desempate";
  }

  return "Rodada de 32 final";
}

function localizedNote(note: string): string {
  if (
    note ===
    "Round of 32 entrants are provisional until all group results and tiebreakers are resolved."
  ) {
    return "Entradas da Rodada de 32 são provisórias até todos os resultados dos grupos e critérios de desempate serem resolvidos.";
  }

  if (note === "Later rounds are visual placeholders until reviewed knockout topology is available.") {
    return "As rodadas seguintes são marcadores visuais até a estrutura revisada do mata-mata estar disponível.";
  }

  if (note === "Later rounds update from stored knockout results as matches finish.") {
    return "As rodadas seguintes são atualizadas com os resultados armazenados do mata-mata.";
  }

  if (note === "Round of 32 entrants are resolved from complete group-stage results.") {
    return "Entradas da Rodada de 32 definidas pelos resultados completos da fase de grupos.";
  }

  if (note.startsWith("Round of 32 cannot be finalized: ")) {
    return `Rodada de 32 não pode ser finalizada: ${note.slice("Round of 32 cannot be finalized: ".length)}`;
  }

  if (
    note === "Manual tiebreaker data is required before final bracket entrants can be published."
  ) {
    return "Dados de desempate manual são necessários antes de publicar as entradas finais da chave.";
  }

  return note;
}
