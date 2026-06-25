import { describe, expect, test } from "vitest";

import type { StandingsResult } from "../standings/standings.js";
import { resolveKnockoutMatchParticipants } from "./knockout-resolution.js";
import { WORLD_CUP_2026_SEED } from "./seed.js";
import { isGroupStageMatch } from "./types.js";

describe("resolveKnockoutMatchParticipants", () => {
  test("keeps explicit placeholders before group results are complete", () => {
    const resolved = resolveKnockoutMatchParticipants(WORLD_CUP_2026_SEED.matches, []);

    expect(matchByNumber(resolved, 73)).toMatchObject({
      homeTeam: { code: "2A", name: "2º Grupo A" },
      awayTeam: { code: "2B", name: "2º Grupo B" }
    });
  });

  test("resolves round-of-32 teams from complete group-stage results", () => {
    const resolved = resolveKnockoutMatchParticipants(
      WORLD_CUP_2026_SEED.matches,
      currentSeedProofResults()
    );

    expect(matchByNumber(resolved, 73)).toMatchObject({
      homeTeam: { code: "RSA", name: "South Africa" },
      awayTeam: { code: "BIH", name: "Bosnia and Herzegovina" }
    });
    expect(matchByNumber(WORLD_CUP_2026_SEED.matches, 73)).toMatchObject({
      homeTeam: { code: "2A" },
      awayTeam: { code: "2B" }
    });
  });

  test("propagates knockout winners into later rounds when results are available", () => {
    const resolved = resolveKnockoutMatchParticipants(WORLD_CUP_2026_SEED.matches, [
      ...currentSeedProofResults(),
      result("wc2026-074", 2, 0),
      result("wc2026-075", 2, 1),
      result("wc2026-077", 1, 3),
      result("wc2026-089", 1, 0),
      result("wc2026-090", 0, 2),
      result("wc2026-097", 3, 1)
    ]);

    expect(matchByNumber(resolved, 89)).toMatchObject({
      homeTeam: { code: "GER", name: "Germany" },
      awayTeam: { code: "IRN", name: "Iran" }
    });
    expect(matchByNumber(resolved, 97)).toMatchObject({
      homeTeam: { code: "GER", name: "Germany" },
      awayTeam: { code: "NED", name: "Netherlands" }
    });
    expect(matchByNumber(resolved, 101)).toMatchObject({
      homeTeam: { code: "GER", name: "Germany" },
      awayTeam: { code: "W98", name: "Vencedor #98" }
    });
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
    const homeRank = currentSeedRank(match.group, match.homeTeam.code);
    const awayRank = currentSeedRank(match.group, match.awayTeam.code);
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

function currentSeedRank(group: string, teamCode: string): number {
  const order = currentSeedRankOrders[group];
  const index = order?.indexOf(teamCode) ?? -1;

  if (index < 0) {
    throw new Error(`Missing proof-test rank for Group ${group} team ${teamCode}.`);
  }

  return index + 1;
}

function result(matchId: string, homeScore: number, awayScore: number): StandingsResult {
  return { matchId, homeScore, awayScore };
}

function matchByNumber(matches: readonly typeof WORLD_CUP_2026_SEED.matches[number][], matchNumber: number) {
  const match = matches.find((candidate) => candidate.matchNumber === matchNumber);

  if (!match) {
    throw new Error(`Missing match #${matchNumber}`);
  }

  return match;
}
