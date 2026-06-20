import { describe, expect, test } from "vitest";

import { createBracketState } from "./state.js";
import type { StandingsResult } from "../standings/standings.js";
import { WORLD_CUP_2026_SEED } from "../worldcup/seed.js";
import type { WorldCupMatch } from "../worldcup/types.js";

describe("createBracketState", () => {
  test("creates a whole bracket skeleton with provisional round-of-32 entrants from incomplete group results", () => {
    const state = createBracketState({
      matches: groupMatches(["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"]),
      results: [
        result("A-AB", 1, 0),
        result("B-AB", 2, 0),
        result("C-AB", 3, 0)
      ]
    });

    expect(state.phase).toBe("provisional");
    expect(state.rounds.map((round) => round.key)).toEqual([
      "round_of_32",
      "round_of_16",
      "quarter_finals",
      "semi_finals",
      "final"
    ]);
    expect(state.rounds[0]?.matches).toHaveLength(16);
    expect(state.rounds[0]?.matches[0]?.label).toBe("#73");
    expect(state.rounds[0]?.matches[0]?.home.sourceSlot).toBe("2A");
    expect(state.rounds[0]?.matches[0]?.away.sourceSlot).toBe("2B");
    expect(state.rounds[1]?.matches[0]?.home.label).toBe("W-32-1");
    expect(state.rounds[0]?.matches.some((match) => match.state === "provisional")).toBe(true);
    expect(
      state.rounds[0]?.matches.some(
        (match) =>
          match.home.warning === "tie-order-provisional" ||
          match.away.warning === "tie-order-provisional"
      )
    ).toBe(true);
  });

  test("marks third-place entrants provisional when the eighth and ninth third-place rows are tied", () => {
    const state = createBracketState({
      matches: groupMatches(["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"]),
      results: thirdPlaceCutoffTieResults()
    });
    const roundOf32 = state.rounds.find((round) => round.key === "round_of_32");
    const entrants = roundOf32?.matches.flatMap((match) => [match.home, match.away]) ?? [];

    expect(state.phase).toBe("provisional");
    expect(
      entrants.some(
        (entrant) =>
          entrant.sourceSlot?.startsWith("3") &&
          entrant.warning === "tie-order-provisional"
      )
    ).toBe(true);
  });

  test("uses reviewed official tiebreaker order for provisional Group C bracket slots", () => {
    const state = createBracketState({
      matches: WORLD_CUP_2026_SEED.matches,
      results: [result("wc2026-006", 1, 1), result("wc2026-007", 0, 1)]
    });
    const roundOf32 = state.rounds.find((round) => round.key === "round_of_32");

    expect(state.phase).toBe("provisional");
    expect(
      roundOf32?.matches.find((matchFixture) => matchFixture.label === "#75")?.away
    ).toMatchObject({
      sourceSlot: "2C",
      teamCode: "MAR"
    });
    expect(
      roundOf32?.matches
        .flatMap((matchFixture) => [matchFixture.home, matchFixture.away])
        .find((entrant) => entrant.sourceSlot === "3C")
    ).toMatchObject({
      sourceSlot: "3C",
      teamCode: "BRA"
    });
  });

  test("uses reviewed official tiebreaker order for current provisional round-of-32 slots", () => {
    const state = createBracketState({
      matches: WORLD_CUP_2026_SEED.matches,
      results: currentStoredResults()
    });
    const roundOf32 = state.rounds.find((round) => round.key === "round_of_32");

    expect(state.phase).toBe("provisional");
    expect(
      roundOf32?.matches.map((match) => [
        match.label,
        match.home.sourceSlot,
        match.home.teamCode,
        match.away.sourceSlot,
        match.away.teamCode
      ])
    ).toEqual([
      ["#73", "2A", "KOR", "2B", "SUI"],
      ["#74", "1E", "GER", "3C", "SCO"],
      ["#75", "1F", "SWE", "2C", "MAR"],
      ["#76", "1C", "BRA", "2F", "JPN"],
      ["#77", "1I", "NOR", "3F", "NED"],
      ["#78", "2E", "CIV", "2I", "FRA"],
      ["#79", "1A", "MEX", "3H", "ESP"],
      ["#80", "1L", "ENG", "3K", "POR"],
      ["#81", "1D", "USA", "3B", "BIH"],
      ["#82", "1G", "NZL", "3A", "CZE"],
      ["#83", "2K", "COD", "2L", "GHA"],
      ["#84", "1H", "URU", "2J", "AUT"],
      ["#85", "1B", "CAN", "3G", "BEL"],
      ["#86", "1J", "ARG", "2H", "KSA"],
      ["#87", "1K", "COL", "3D", "PAR"],
      ["#88", "2D", "AUS", "2G", "IRN"]
    ]);
  });

  test("resolves final round-of-32 entrants from reviewed current match data", () => {
    const state = createBracketState({
      matches: WORLD_CUP_2026_SEED.matches,
      results: currentSeedProofResults()
    });
    const roundOf32 = state.rounds.find((round) => round.key === "round_of_32");

    expect(state.phase).toBe("final");
    expect(roundOf32?.matches.map((match) => match.state)).toEqual(
      Array.from({ length: 16 }, () => "final")
    );
    expect(
      roundOf32?.matches.map((match) => [
        match.label,
        match.home.sourceSlot,
        match.home.teamCode,
        match.away.sourceSlot,
        match.away.teamCode
      ])
    ).toEqual([
      ["#73", "2A", "RSA", "2B", "BIH"],
      ["#74", "1E", "GER", "3F", "SWE"],
      ["#75", "1F", "NED", "2C", "MAR"],
      ["#76", "1C", "BRA", "2F", "JPN"],
      ["#77", "1I", "FRA", "3G", "IRN"],
      ["#78", "2E", "CUW", "2I", "SEN"],
      ["#79", "1A", "MEX", "3E", "CIV"],
      ["#80", "1L", "ENG", "3K", "UZB"],
      ["#81", "1D", "USA", "3I", "IRQ"],
      ["#82", "1G", "BEL", "3H", "KSA"],
      ["#83", "2K", "COD", "2L", "CRO"],
      ["#84", "1H", "ESP", "2J", "ALG"],
      ["#85", "1B", "CAN", "3J", "AUT"],
      ["#86", "1J", "ARG", "2H", "CPV"],
      ["#87", "1K", "POR", "3L", "GHA"],
      ["#88", "2D", "PAR", "2G", "EGY"]
    ]);
  });

  test("reports blocked state instead of guessing when complete results still need manual tiebreakers", () => {
    const matches = groupMatches(["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"]);
    const state = createBracketState({
      matches,
      results: matches.map((matchFixture) => result(matchFixture.id, 0, 0))
    });
    const roundOf32 = state.rounds.find((round) => round.key === "round_of_32");

    expect(state.phase).toBe("blocked");
    expect(state.notes.some((note) => note.includes("manual tiebreaker"))).toBe(true);
    expect(roundOf32?.matches.some((matchFixture) => matchFixture.state === "blocked")).toBe(
      true
    );
  });
});

function currentStoredResults(): StandingsResult[] {
  return [
    result("wc2026-001", 2, 0),
    result("wc2026-002", 2, 1),
    result("wc2026-003", 1, 1),
    result("wc2026-004", 4, 1),
    result("wc2026-005", 1, 1),
    result("wc2026-006", 1, 1),
    result("wc2026-007", 0, 1),
    result("wc2026-008", 2, 0),
    result("wc2026-009", 7, 1),
    result("wc2026-010", 2, 2),
    result("wc2026-011", 1, 0),
    result("wc2026-012", 5, 1),
    result("wc2026-013", 0, 0),
    result("wc2026-014", 1, 1),
    result("wc2026-015", 1, 1),
    result("wc2026-016", 2, 2),
    result("wc2026-017", 3, 1),
    result("wc2026-018", 1, 4),
    result("wc2026-019", 3, 0),
    result("wc2026-020", 3, 1),
    result("wc2026-021", 1, 1),
    result("wc2026-022", 4, 2),
    result("wc2026-023", 1, 0),
    result("wc2026-024", 1, 3),
    result("wc2026-025", 1, 1),
    result("wc2026-026", 4, 1),
    result("wc2026-027", 6, 0),
    result("wc2026-028", 1, 0),
    result("wc2026-029", 2, 0),
    result("wc2026-030", 0, 1),
    result("wc2026-031", 3, 0),
    result("wc2026-032", 0, 1)
  ];
}

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
  return WORLD_CUP_2026_SEED.matches.map((matchFixture) => {
    const homeRank = currentSeedRank(matchFixture.group, matchFixture.homeTeam.code);
    const awayRank = currentSeedRank(matchFixture.group, matchFixture.awayTeam.code);
    const winnerIsHome = homeRank < awayRank;
    const winnerRank = Math.min(homeRank, awayRank);
    const loserRank = Math.max(homeRank, awayRank);
    const winnerGoals =
      winnerRank === 3 && loserRank === 4 && matchFixture.group >= "E" ? 5 : 3;

    return result(
      matchFixture.id,
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

function thirdPlaceCutoffTieResults(): StandingsResult[] {
  return "ABCDEFGHI".split("").flatMap((group) => [
    result(`${group}-AB`, 3, 0),
    result(`${group}-AC`, 3, 0),
    result(`${group}-AD`, 3, 0),
    result(`${group}-BC`, 2, 0),
    result(`${group}-BD`, 2, 0),
    result(`${group}-CD`, 1, 0)
  ]);
}

function result(matchId: string, homeScore: number, awayScore: number): StandingsResult {
  return { matchId, homeScore, awayScore };
}

function groupMatches(groups: readonly string[]): WorldCupMatch[] {
  return groups.flatMap((group) => [
    match(`${group}-AB`, group, `${group}1`, `${group}2`, 1),
    match(`${group}-AC`, group, `${group}1`, `${group}3`, 2),
    match(`${group}-AD`, group, `${group}1`, `${group}4`, 3),
    match(`${group}-BC`, group, `${group}2`, `${group}3`, 4),
    match(`${group}-BD`, group, `${group}2`, `${group}4`, 5),
    match(`${group}-CD`, group, `${group}3`, `${group}4`, 6)
  ]);
}

function match(
  id: string,
  group: string,
  homeCode: string,
  awayCode: string,
  offset: number
): WorldCupMatch {
  return {
    id,
    matchNumber: group.charCodeAt(0) * 10 + offset,
    phase: "group",
    group,
    homeTeam: { code: homeCode, name: `${homeCode} Name` },
    awayTeam: { code: awayCode, name: `${awayCode} Name` },
    localDate: "2026-06-11",
    kickoffTimeLocal: "13:00",
    kickoffAtUtc: "2026-06-11T19:00:00.000Z",
    venue: "Test Stadium",
    sourceId: "test-source",
    externalIds: {}
  };
}
