import { describe, expect, test } from "vitest";

import { computeThirdPlaceStandings } from "./standings.js";
import type { StandingsResult } from "../standings/standings.js";
import { WORLD_CUP_2026_SEED } from "../worldcup/seed.js";
import { isGroupStageMatch, type WorldCupGroupMatch } from "../worldcup/types.js";

describe("computeThirdPlaceStandings", () => {
  test("marks the FIFA eighth-place cutoff when the boundary needs manual tie data", () => {
    const standings = computeThirdPlaceStandings(WORLD_CUP_2026_SEED.matches, []);

    expect(standings.status).toBe("needs-manual-tiebreaker");
    expect(standings.rows).toHaveLength(12);
    expect(standings.rows.map((row) => row.qualificationState)).toEqual(
      Array.from({ length: 12 }, () => "cutoff")
    );
  });

  test("ranks all third-place teams by FIFA points, goal difference, and goals-for order", () => {
    const standings = computeThirdPlaceStandings(
      WORLD_CUP_2026_SEED.matches,
      currentSeedProofResults()
    );

    expect(standings.status).toBe("resolved");
    expect(standings.rows.map((row) => [row.thirdPlaceRank, row.group, row.teamCode])).toEqual([
      [1, "E", "CIV"],
      [2, "F", "SWE"],
      [3, "G", "IRN"],
      [4, "H", "KSA"],
      [5, "I", "IRQ"],
      [6, "J", "AUT"],
      [7, "K", "UZB"],
      [8, "L", "GHA"],
      [9, "A", "KOR"],
      [10, "B", "QAT"],
      [11, "C", "HAI"],
      [12, "D", "AUS"]
    ]);
    expect(standings.rows.slice(0, 8).map((row) => row.qualificationState)).toEqual(
      Array.from({ length: 8 }, () => "advancing")
    );
    expect(standings.rows.slice(8).map((row) => row.qualificationState)).toEqual(
      Array.from({ length: 4 }, () => "outside")
    );
  });
});

const currentSeedRankOrderByGroup = {
  A: ["MEX", "RSA", "KOR", "CZE"],
  B: ["CAN", "BIH", "QAT", "SUI"],
  C: ["BRA", "MAR", "HAI", "SCO"],
  D: ["USA", "PAR", "AUS", "TUR"],
  E: ["GER", "CUW", "CIV", "ECU"],
  F: ["NED", "JPN", "SWE", "TUN"],
  G: ["BEL", "EGY", "IRN", "NZL"],
  H: ["ESP", "CPV", "KSA", "URU"],
  I: ["FRA", "SEN", "IRQ", "NOR"],
  J: ["ARG", "ALG", "AUT", "JOR"],
  K: ["POR", "COD", "UZB", "COL"],
  L: ["ENG", "CRO", "GHA", "PAN"]
} as const satisfies Record<string, readonly string[]>;
const currentSeedRankOrders: Readonly<Record<string, readonly string[]>> =
  currentSeedRankOrderByGroup;

function currentSeedProofResults(): StandingsResult[] {
  return WORLD_CUP_2026_SEED.matches.filter(isGroupStageMatch).map((match) => {
    const homeRank = currentSeedRank(match, match.homeTeam.code);
    const awayRank = currentSeedRank(match, match.awayTeam.code);
    const winnerIsHome = homeRank < awayRank;
    const winnerRank = Math.min(homeRank, awayRank);
    const loserRank = Math.max(homeRank, awayRank);
    const winnerGoals = winnerRank === 3 && loserRank === 4 && match.group >= "E" ? 5 : 3;

    return result(
      match.id,
      winnerIsHome ? winnerGoals : 0,
      winnerIsHome ? 0 : winnerGoals
    );
  });
}

function currentSeedRank(match: WorldCupGroupMatch, teamCode: string): number {
  const order = currentSeedRankOrders[match.group];
  const index = order?.indexOf(teamCode) ?? -1;

  if (index < 0) {
    throw new Error(`Missing proof-test rank for Group ${match.group} team ${teamCode}.`);
  }

  return index + 1;
}

function result(matchId: string, homeScore: number, awayScore: number): StandingsResult {
  return { matchId, homeScore, awayScore };
}
