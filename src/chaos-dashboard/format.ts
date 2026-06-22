import type { Buffer } from "node:buffer";

import type { ChaosDashboardModel } from "./types.js";

export const CHAOS_DASHBOARD_TITLE = "Copanalhas Recap";
export const CHAOS_ATTACHMENT_NAME = "copanalhas-recap.png";

export interface ChaosDashboardMessage {
  content: string;
  embeds: [];
  files: Array<{ attachment: Buffer; name: string }>;
}

export function createChaosDashboardMessage(
  model: ChaosDashboardModel,
  png: Buffer | null
): ChaosDashboardMessage {
  return {
    content: [
      `**${CHAOS_DASHBOARD_TITLE}**`,
      `Atualizado: ${model.generatedAtLabel}`,
      `Periodo: ${model.period.label}`,
      `Jogos pontuados: ${model.totals.scoredMatches} | Palpites: ${model.totals.predictions}`,
      png ? "Imagem atualizada." : "Imagem indisponivel no momento; usando fallback de texto."
    ].join("\n"),
    embeds: [],
    files: png ? [{ attachment: png, name: CHAOS_ATTACHMENT_NAME }] : []
  };
}
