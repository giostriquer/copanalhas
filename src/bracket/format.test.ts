import { Buffer } from "node:buffer";

import { describe, expect, test } from "vitest";

import { createBracketDashboardMessage } from "./format.js";
import type { BracketState } from "./types.js";

describe("createBracketDashboardMessage", () => {
  test("formats dashboard content and PNG attachment", () => {
    const png = Buffer.from([1, 2, 3]);
    const message = createBracketDashboardMessage(bracketState(), png);

    expect(message.content).toContain("World Cup 2026 Bracket");
    expect(message.content).toContain("As it stands");
    expect(message.content).toContain("2026-06-19 15:00");
    expect(message.content).toContain("Round of 32 entrants are provisional.");
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
    generatedAtLabel: "2026-06-19 15:00",
    notes: ["Round of 32 entrants are provisional."],
    rounds: []
  };
}
