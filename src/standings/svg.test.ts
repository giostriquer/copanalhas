import { describe, expect, test } from "vitest";

import { renderStandingsDashboardSvg } from "./svg.js";
import { computeGroupStandings } from "./standings.js";
import { WORLD_CUP_2026_SEED } from "../worldcup/seed.js";
import type { StoredResult } from "../storage/database.js";

describe("renderStandingsDashboardSvg", () => {
  test("renders visual group standings with flags and full columns", () => {
    const standings = computeGroupStandings(WORLD_CUP_2026_SEED.matches, [
      result("wc2026-001", 2, 1)
    ]);
    const svg = renderStandingsDashboardSvg({
      standings,
      groups: ["A", "B", "C", "D", "E", "F"],
      label: "Grupos A-F",
      generatedAtLabel: "2026-06-11 23:30 UTC"
    });

    expect(svg).toContain("<svg");
    expect(svg).toContain('xmlns:xlink="http://www.w3.org/1999/xlink"');
    expect(svg).toContain("Copa do Mundo 2026");
    expect(svg).toContain("Grupos A-F");
    expect(svg).toContain("Atualizado: 2026-06-11 23:30 UTC");
    expect(svg).toContain("Grupo A");
    expect(svg).toContain("Grupo F");
    expect(svg).toContain("México");
    expect(svg).toContain("África do Sul");
    expect(svg).toContain("J");
    expect(svg).toContain("V");
    expect(svg).toContain("E");
    expect(svg).toContain("D");
    expect(svg).toContain("GP");
    expect(svg).toContain("GC");
    expect(svg).toContain("SG");
    expect(svg).toContain("Pts");
    expect(svg).toContain('aria-label="Bandeira do Brasil"');
    expect(svg).toContain('href="data:image/svg+xml;base64,');
    expect(svg).toContain("#FFDF00");
    expect(svg).toContain("#002776");
    expect(svg).toContain("Football data provided by the Football-Data.org API.");
  });

  test("escapes team names before writing SVG text", () => {
    const svg = renderStandingsDashboardSvg({
      standings: [
        {
          group: "A",
          rows: [
            {
              rank: 1,
              group: "A",
              teamCode: "XXX",
          teamName: "A <B> & C",
              played: 0,
              wins: 0,
              draws: 0,
              losses: 0,
              goalsFor: 0,
              goalsAgainst: 0,
              goalDifference: 0,
              points: 0
            }
          ]
        }
      ],
      groups: ["A"],
      label: "Grupo A",
      generatedAtLabel: "2026-06-11 23:30 UTC"
    });

    expect(svg).toContain("A &lt;B&gt; &amp; C");
    expect(svg).not.toContain("A <B> & C");
  });
});

function result(matchId: string, homeScore: number, awayScore: number): StoredResult {
  return {
    matchId,
    homeScore,
    awayScore,
    recordedAt: "2026-06-11T23:00:00.000Z",
    resultSource: "manual",
    externalMatchId: null,
    fetchedAt: null
  };
}
