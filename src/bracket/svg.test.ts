import { describe, expect, test } from "vitest";

import { renderBracketSvg } from "./svg.js";
import type { BracketState } from "./types.js";

describe("renderBracketSvg", () => {
  test("renders deterministic bracket content, warnings, attribution, and escaped text", () => {
    const svg = renderBracketSvg(bracketState());

    expect(svg).toContain("<svg");
    expect(svg).toContain("World Cup 2026 Bracket");
    expect(svg).toContain("Round of 32");
    expect(svg).toContain("Round of 16");
    expect(svg).toContain("Team &amp; One");
    expect(svg).toContain("Team &lt;Two&gt;");
    expect(svg).toContain("W-32-1");
    expect(svg).toContain("As it stands");
    expect(svg).toContain("tie-order provisional");
    expect(svg).toContain("Football data provided by the Football-Data.org API.");
    expect(svg.indexOf("#73")).toBeLessThan(svg.indexOf("#74"));
    expect(svg.indexOf("#74")).toBeLessThan(svg.indexOf("#75"));
    expect(svg).not.toContain("Team & One");
    expect(svg).not.toContain("Team <Two>");
  });
});

function bracketState(): BracketState {
  return {
    phase: "provisional",
    generatedAtLabel: "2026-06-19 15:00",
    notes: ["Round of 32 entrants are provisional."],
    rounds: [
      {
        key: "round_of_32",
        label: "Round of 32",
        matches: [
          {
            id: "r32-73",
            label: "#73",
            state: "provisional",
            home: {
              label: "T1",
              teamCode: "T1",
              teamName: "Team & One",
              sourceSlot: "2A"
            },
            away: {
              label: "T2",
              teamCode: "T2",
              teamName: "Team <Two>",
              sourceSlot: "2B",
              warning: "tie-order-provisional"
            }
          },
          {
            id: "r32-74",
            label: "#74",
            state: "provisional",
            home: { label: "GER", teamCode: "GER", teamName: "Germany", sourceSlot: "1E" },
            away: { label: "3F", sourceSlot: "3F" }
          },
          {
            id: "r32-75",
            label: "#75",
            state: "provisional",
            home: { label: "NED", teamCode: "NED", teamName: "Netherlands", sourceSlot: "1F" },
            away: { label: "2C", sourceSlot: "2C" }
          }
        ]
      },
      {
        key: "round_of_16",
        label: "Round of 16",
        matches: [
          {
            id: "round_of_16-1",
            label: "Round of 16",
            state: "scheduled",
            home: { label: "W-32-1", sourceSlot: "W-32-1" },
            away: { label: "W-32-2", sourceSlot: "W-32-2" }
          }
        ]
      },
      { key: "quarter_finals", label: "Quarter-finals", matches: [] },
      { key: "semi_finals", label: "Semi-finals", matches: [] },
      { key: "final", label: "Final", matches: [] }
    ]
  };
}
