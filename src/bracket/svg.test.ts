import { describe, expect, test } from "vitest";

import { renderBracketSvg } from "./svg.js";
import type { BracketState } from "./types.js";

describe("renderBracketSvg", () => {
  test("renders a full-path bracket with pt-BR names, real flag assets, and warnings", () => {
    const svg = renderBracketSvg(bracketState());

    expect(svg).toContain("<svg");
    expect(svg).toContain('width="2000"');
    expect(svg).toContain('height="1028"');
    expect(svg).toContain("Copa do Mundo 2026 - Mata-mata");
    expect(svg).toContain("Rodada de 32");
    expect(svg).toContain("Team &amp; One");
    expect(svg).toContain("Team &lt;Two&gt;");
    expect(svg).toContain('data-bracket-column="round-of-32"');
    expect(svg).toContain('data-bracket-column="round-of-16"');
    expect(svg).toContain('data-bracket-column="quarter-finals"');
    expect(svg).toContain('data-bracket-column="semi-finals"');
    expect(svg).toContain('data-bracket-column="finals"');
    expect(svg).toContain('data-connector-match="89"');
    expect(svg).toContain('data-connector-match="97"');
    expect(svg).toContain('data-connector-match="101"');
    expect(svg).toContain('data-connector-match="104"');
    expect(svg).toContain('data-path-match="101"');
    expect(svg).toContain('data-path-match="102"');
    expect(svg).toContain('data-path-match="103"');
    expect(svg).toContain('data-path-match="104"');
    expect(svg).toContain('data-flag-team-code="GER"');
    expect(svg).toContain('data-flag-asset="de.svg"');
    expect(svg).toContain("data:image/svg+xml;base64,");
    expect(svg).toContain('data-qualification-security="locked-slot"');
    expect(svg).toContain('stroke="#23845a"');
    expect(svg).toContain('data-qualification-security="qualified-floating"');
    expect(svg).toContain('stroke="#f2b705"');
    expect(svg).toContain('data-qualification-security="not-secured"');
    expect(svg).toContain('stroke="#d92d20"');
    expect(svg).toContain("Alemanha");
    expect(svg).toContain('data-flag-team-code="MAR"');
    expect(svg).toContain('data-flag-asset="ma.svg"');
    expect(svg).toContain("Marrocos");
    expect(svg).toContain('data-flag-team-code="NED"');
    expect(svg).toContain('data-flag-asset="nl.svg"');
    expect(svg).toContain("Holanda");
    expect(svg).toContain("28/06 16:00 GMT-3");
    expect(svg).toContain("04/07 18:00 GMT-3");
    expect(svg).toContain("09/07 17:00 GMT-3");
    expect(svg).toContain("14/07 16:00 GMT-3");
    expect(svg).toContain("18/07 18:00 GMT-3");
    expect(svg).toContain("19/07 16:00 GMT-3");
    expect(svg).toContain(
      'data-r32-heading-side="left" x="187" y="148" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="14"'
    );
    expect(svg).toContain(
      'data-r32-heading-side="right" x="1813" y="148" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="14"'
    );
    expect(svg).toContain(
      'data-kickoff-label-side="right" x="270" y="-12" text-anchor="end" font-family="Inter, Arial, sans-serif" font-size="11"'
    );
    expect(svg).toContain(
      'data-path-kickoff-label-match="89" x="0" y="-8" font-family="Inter, Arial, sans-serif" font-size="11"'
    );
    expect(svg).toContain(
      'data-path-kickoff-label-match="104" x="0" y="-8" font-family="Inter, Arial, sans-serif" font-size="11"'
    );
    expect(svg).toContain("Como está ficando");
    expect(svg).toContain("Oitavas");
    expect(svg).toContain("Quartas");
    expect(svg).toContain("Semifinal");
    expect(svg).toContain("Final");
    expect(svg).toContain("Decisão do 3º lugar");
    expect(svg).toContain("Vencedor #101");
    expect(svg).toContain("Vencedor #102");
    expect(svg).toContain("Perdedor #101");
    expect(svg).toContain("Perdedor #102");
    expect(svg).not.toContain("ordem provisória");
    expect(svg).not.toContain("Lado esquerdo");
    expect(svg).not.toContain("Lado direito");
    expect(svg).toContain("Football data provided by the Football-Data.org API.");
    expect(svg).not.toContain(">Como está</text>");
    expect(svg).not.toContain("caminho para a semifinal");
    expect(svg).not.toContain("Rodada de 32 com caminhos oficiais para oitavas e quartas.");
    expect(svg).not.toContain("data-flag-code=");
    expect(svg).not.toContain("Round of 16");
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
            kickoffLabel: "28/06 16:00 GMT-3",
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
            away: {
              label: "MAR",
              teamCode: "MAR",
              teamName: "Morocco",
              sourceSlot: "3C",
              qualificationSecurity: "not-secured"
            }
          },
          {
            id: "r32-75",
            label: "#75",
            state: "provisional",
            home: {
              label: "NED",
              teamCode: "NED",
              teamName: "Netherlands",
              sourceSlot: "1F",
              qualificationSecurity: "qualified-floating"
            },
            away: { label: "2C", sourceSlot: "2C" }
          },
          {
            id: "r32-76",
            label: "#76",
            state: "provisional",
            home: {
              label: "BRA",
              teamCode: "BRA",
              teamName: "Brazil",
              sourceSlot: "1C",
              qualificationSecurity: "locked-slot"
            },
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
          },
          {
            id: "r32-80",
            label: "#80",
            state: "provisional",
            home: { label: "ENG", teamCode: "ENG", teamName: "England", sourceSlot: "1L" },
            away: { label: "3K", sourceSlot: "3K" }
          },
          {
            id: "r32-81",
            label: "#81",
            state: "provisional",
            home: { label: "USA", teamCode: "USA", teamName: "United States", sourceSlot: "1D" },
            away: { label: "3B", sourceSlot: "3B" }
          },
          {
            id: "r32-82",
            label: "#82",
            state: "provisional",
            home: { label: "NZL", teamCode: "NZL", teamName: "New Zealand", sourceSlot: "1G" },
            away: { label: "3A", sourceSlot: "3A" }
          },
          {
            id: "r32-83",
            label: "#83",
            state: "provisional",
            home: { label: "COD", teamCode: "COD", teamName: "DR Congo", sourceSlot: "2K" },
            away: { label: "GHA", teamCode: "GHA", teamName: "Ghana", sourceSlot: "2L" }
          },
          {
            id: "r32-84",
            label: "#84",
            state: "provisional",
            home: { label: "URU", teamCode: "URU", teamName: "Uruguay", sourceSlot: "1H" },
            away: { label: "2J", sourceSlot: "2J" }
          },
          {
            id: "r32-85",
            label: "#85",
            state: "provisional",
            home: { label: "CAN", teamCode: "CAN", teamName: "Canada", sourceSlot: "1B" },
            away: { label: "3G", sourceSlot: "3G" }
          },
          {
            id: "r32-86",
            label: "#86",
            state: "provisional",
            home: { label: "ARG", teamCode: "ARG", teamName: "Argentina", sourceSlot: "1J" },
            away: { label: "2H", sourceSlot: "2H" }
          },
          {
            id: "r32-87",
            label: "#87",
            state: "provisional",
            home: { label: "COL", teamCode: "COL", teamName: "Colombia", sourceSlot: "1K" },
            away: { label: "3D", sourceSlot: "3D" }
          },
          {
            id: "r32-88",
            label: "#88",
            state: "provisional",
            home: { label: "AUS", teamCode: "AUS", teamName: "Australia", sourceSlot: "2D" },
            away: { label: "2G", sourceSlot: "2G" }
          }
        ]
      },
      {
        key: "round_of_16",
        label: "Round of 16",
        matches: [
          {
            id: "round_of_16-1",
            label: "#89",
            state: "scheduled",
            kickoffLabel: "04/07 18:00 GMT-3",
            home: { label: "W-32-1", sourceSlot: "W-32-1" },
            away: { label: "W-32-2", sourceSlot: "W-32-2" }
          }
        ]
      },
      {
        key: "quarter_finals",
        label: "Quarter-finals",
        matches: [
          {
            id: "quarter_finals-1",
            label: "#97",
            state: "scheduled",
            kickoffLabel: "09/07 17:00 GMT-3",
            home: { label: "W-16-1", sourceSlot: "W-16-1" },
            away: { label: "W-16-2", sourceSlot: "W-16-2" }
          }
        ]
      },
      {
        key: "semi_finals",
        label: "Semi-finals",
        matches: [
          {
            id: "semi_finals-1",
            label: "#101",
            state: "scheduled",
            kickoffLabel: "14/07 16:00 GMT-3",
            home: { label: "W-QF-1", sourceSlot: "W-QF-1" },
            away: { label: "W-QF-2", sourceSlot: "W-QF-2" }
          }
        ]
      },
      {
        key: "third_place",
        label: "Third-place play-off",
        matches: [
          {
            id: "third_place-1",
            label: "#103",
            state: "scheduled",
            kickoffLabel: "18/07 18:00 GMT-3",
            home: { label: "L-SF-1", sourceSlot: "L-SF-1" },
            away: { label: "L-SF-2", sourceSlot: "L-SF-2" }
          }
        ]
      },
      {
        key: "final",
        label: "Final",
        matches: [
          {
            id: "final-1",
            label: "#104",
            state: "scheduled",
            kickoffLabel: "19/07 16:00 GMT-3",
            home: { label: "W-SF-1", sourceSlot: "W-SF-1" },
            away: { label: "W-SF-2", sourceSlot: "W-SF-2" }
          }
        ]
      }
    ]
  };
}
