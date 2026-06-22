import { describe, expect, test } from "vitest";

import {
  completedChaosRecapPeriods,
  listChaosRecapPeriods,
  matchesForChaosRecapPeriod
} from "./periods.js";
import type { MatchResult } from "../scoring/scoring.js";
import { WORLD_CUP_2026_SEED } from "../worldcup/seed.js";

describe("chaos recap periods", () => {
  test("defines the three group-stage recap periods by reviewed match ranges", () => {
    const periods = listChaosRecapPeriods(WORLD_CUP_2026_SEED.matches);

    expect(periods.map((period) => [period.key, period.label])).toEqual([
      ["group-week-1", "Fase de grupos - semana 1"],
      ["group-week-2", "Fase de grupos - semana 2"],
      ["group-week-3", "Fase de grupos - semana 3"]
    ]);
    expect(matchesForChaosRecapPeriod(periods[0]!, WORLD_CUP_2026_SEED.matches).map(matchNumber))
      .toEqual(range(1, 24));
    expect(matchesForChaosRecapPeriod(periods[1]!, WORLD_CUP_2026_SEED.matches).map(matchNumber))
      .toEqual(range(25, 48));
    expect(matchesForChaosRecapPeriod(periods[2]!, WORLD_CUP_2026_SEED.matches).map(matchNumber))
      .toEqual(range(49, 72));
  });

  test("marks only periods with every match result as completed", () => {
    const periods = listChaosRecapPeriods(WORLD_CUP_2026_SEED.matches);
    const results = WORLD_CUP_2026_SEED.matches
      .filter((match) => match.matchNumber <= 24)
      .map((match) => resultFor(match.id));

    expect(completedChaosRecapPeriods(periods, results).map((period) => period.key)).toEqual([
      "group-week-1"
    ]);
  });
});

function matchNumber(match: { matchNumber: number }): number {
  return match.matchNumber;
}

function range(start: number, end: number): number[] {
  return Array.from({ length: end - start + 1 }, (_value, index) => start + index);
}

function resultFor(matchId: string): MatchResult {
  return { matchId, homeScore: 1, awayScore: 0 };
}
