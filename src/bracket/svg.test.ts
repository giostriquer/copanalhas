import { describe, expect, test } from "vitest";

import { renderBracketSvg } from "./svg.js";
import type { BracketState } from "./types.js";

describe("renderBracketSvg", () => {
  test("renders a reference-style split bracket with pt-BR names, real flag assets, and warnings", () => {
    const svg = renderBracketSvg(bracketState());

    expect(svg).toContain("<svg");
    expect(svg).toContain("Copa do Mundo 2026 - Mata-mata");
    expect(svg).toContain("Rodada de 32");
    expect(svg).toContain("Lado esquerdo");
    expect(svg).toContain("Lado direito");
    expect(svg).toContain("Team &amp; One");
    expect(svg).toContain("Team &lt;Two&gt;");
    expect(svg).toContain('data-bracket-column="round-of-32"');
    expect(svg).toContain('data-bracket-column="round-of-16"');
    expect(svg).toContain('data-bracket-column="quarter-finals"');
    expect(svg).toContain('data-connector-match="89"');
    expect(svg).toContain('data-connector-match="97"');
    expect(svg).toContain('data-flag-team-code="GER"');
    expect(svg).toContain('data-flag-asset="de.svg"');
    expect(svg).toContain("data:image/svg+xml;base64,");
    expect(svg).toContain("Alemanha");
    expect(svg).toContain('data-flag-team-code="MAR"');
    expect(svg).toContain('data-flag-asset="ma.svg"');
    expect(svg).toContain("Marrocos");
    expect(svg).toContain('data-flag-team-code="NED"');
    expect(svg).toContain('data-flag-asset="nl.svg"');
    expect(svg).toContain("Holanda");
    expect(svg).toContain("Como está");
    expect(svg).toContain("Oitavas");
    expect(svg).toContain("Quartas");
    expect(svg).toContain("ordem provisória");
    expect(svg).toContain("Football data provided by the Football-Data.org API.");
    expect(svg).not.toContain("data-flag-code=");
    expect(svg).not.toContain("Round of 16");
    expect(svg).not.toContain("W-32-1");
    expect(svg.indexOf('data-match-id="r32-74"')).toBeLessThan(
      svg.indexOf('data-match-id="r32-77"')
    );
    expect(svg.indexOf('data-match-id="r32-77"')).toBeLessThan(
      svg.indexOf('data-match-id="r32-73"')
    );
    expect(svg.indexOf('data-match-id="r32-73"')).toBeLessThan(
      svg.indexOf('data-match-id="r32-75"')
    );
    expect(svg.indexOf('data-match-id="r32-76"')).toBeLessThan(
      svg.indexOf('data-match-id="r32-78"')
    );
    expect(svg.indexOf('data-match-id="r32-78"')).toBeLessThan(
      svg.indexOf('data-match-id="r32-79"')
    );
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
            away: { label: "MAR", teamCode: "MAR", teamName: "Morocco", sourceSlot: "3C" }
          },
          {
            id: "r32-75",
            label: "#75",
            state: "provisional",
            home: { label: "NED", teamCode: "NED", teamName: "Netherlands", sourceSlot: "1F" },
            away: { label: "2C", sourceSlot: "2C" }
          },
          {
            id: "r32-76",
            label: "#76",
            state: "provisional",
            home: { label: "BRA", teamCode: "BRA", teamName: "Brazil", sourceSlot: "1C" },
            away: { label: "2F", sourceSlot: "2F" }
          },
          {
            id: "r32-77",
            label: "#77",
            state: "provisional",
            home: { label: "FRA", teamCode: "FRA", teamName: "France", sourceSlot: "1I" },
            away: { label: "3G", sourceSlot: "3G" }
          },
          {
            id: "r32-78",
            label: "#78",
            state: "provisional",
            home: { label: "CUW", teamCode: "CUW", teamName: "Curacao", sourceSlot: "2E" },
            away: { label: "2I", sourceSlot: "2I" }
          },
          {
            id: "r32-79",
            label: "#79",
            state: "provisional",
            home: { label: "MEX", teamCode: "MEX", teamName: "Mexico", sourceSlot: "1A" },
            away: { label: "3E", sourceSlot: "3E" }
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
