import { describe, expect, test } from "vitest";

import { renderThirdPlaceDashboardSvg } from "./svg.js";
import type { ThirdPlaceStandingRow, ThirdPlaceStandings } from "./standings.js";

describe("renderThirdPlaceDashboardSvg", () => {
  test("renders a Brazil-themed third-place table with flags and qualification states", () => {
    const svg = renderThirdPlaceDashboardSvg({
      standings: {
        status: "needs-manual-tiebreaker",
        rows: [
          row(1, "A", "MEX", "Mexico", "advancing"),
          row(8, "H", "KSA", "Saudi Arabia", "cutoff"),
          row(9, "I", "IRQ", "Iraq", "outside")
        ]
      },
      generatedAtLabel: "2026-06-24 18:00 GMT-3"
    });

    expect(svg).toContain("Melhores terceiros");
    expect(svg).toContain("Classificação dos terceiros colocados");
    expect(svg).toContain('data-third-place-dashboard-status="needs-manual-tiebreaker"');
    expect(svg).toContain('data-third-place-state="advancing"');
    expect(svg).toContain('data-third-place-state="cutoff"');
    expect(svg).toContain('data-third-place-state="outside"');
    expect(svg).toContain('data-flag-team-code="MEX"');
    expect(svg).toContain('data-flag-asset="mx.svg"');
    expect(svg).toContain("Pts");
    expect(svg).toContain("SG");
    expect(svg).toContain(
      '<rect data-third-place-status-pill="advancing" x="1326"'
    );
  });
});

function row(
  thirdPlaceRank: number,
  group: string,
  teamCode: string,
  teamName: string,
  qualificationState: ThirdPlaceStandingRow["qualificationState"]
): ThirdPlaceStandingRow {
  return {
    thirdPlaceRank,
    qualificationState,
    rank: 3,
    group,
    teamCode,
    teamName,
    played: 2,
    wins: 1,
    draws: 0,
    losses: 1,
    goalsFor: 2,
    goalsAgainst: 2,
    goalDifference: 0,
    points: 3,
    tiebreakerStatus: "resolved"
  };
}
