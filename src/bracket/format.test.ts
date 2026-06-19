import { Buffer } from "node:buffer";

import { describe, expect, test } from "vitest";

import { createBracketDashboardMessage } from "./format.js";
import type { BracketState } from "./types.js";

describe("createBracketDashboardMessage", () => {
  test("formats dashboard content and PNG attachment", () => {
    const png = Buffer.from([1, 2, 3]);
    const message = createBracketDashboardMessage(bracketState(), png);

    expect(message.content).toContain("**World Cup 2026 Bracket**");
    expect(message.content).toContain("Status: Como está");
    expect(message.content).toContain("Atualizado: 2026-06-19 16:47 GMT-3");
    expect(message.content).toContain(
      "- Entradas da Rodada de 32 são provisórias até todos os resultados dos grupos e critérios de desempate serem resolvidos."
    );
    expect(message.content).toContain(
      "- As rodadas seguintes são marcadores visuais até a estrutura revisada do mata-mata estar disponível."
    );
    expect(message.content).not.toContain("As it stands");
    expect(message.content).not.toContain("Updated:");
    expect(message.content).not.toContain("Round of 32 entrants");
    expect(message.content).not.toContain("Later rounds");
    expect(message.content).toContain("Football data provided by the Football-Data.org API.");
    expect(message.embeds).toEqual([]);
    expect(message.files).toHaveLength(1);
    expect(message.files[0]?.attachment).toBe(png);
    expect(message.files[0]?.name).toBe("copanalhas-bracket.png");
  });
});

function bracketState(): BracketState {
  return {
    phase: "provisional",
    generatedAtLabel: "2026-06-19 16:47 GMT-3",
    notes: [
      "Round of 32 entrants are provisional until all group results and tiebreakers are resolved.",
      "Later rounds are visual placeholders until reviewed knockout topology is available."
    ],
    rounds: []
  };
}
