import { describe, expect, test } from "vitest";

import {
  FIFA_2026_ANNEX_C_COLUMNS,
  FIFA_2026_ANNEX_C_ROWS,
  FIFA_2026_ROUND_OF_32_THIRD_PLACE_ALLOWED_GROUPS,
  resolveAnnexCThirdPlaceAssignments,
  resolveWorldCup2026RoundOf32,
  computeFifaGroupStandings
} from "./fifa-qualification.js";
import { WORLD_CUP_2026_SEED } from "./seed.js";
import type { StandingsResult } from "../standings/standings.js";
import {
  isGroupStageMatch,
  type WorldCupGroupMatch,
  type WorldCupMatch,
  type WorldCupTeam
} from "./types.js";

describe("computeFifaGroupStandings", () => {
  test("uses head-to-head results before overall goal difference for teams tied on points", () => {
    const standings = computeFifaGroupStandings(groupMatches("A"), [
      result("A-AB", 1, 0),
      result("A-AC", 0, 4),
      result("A-AD", 1, 0),
      result("A-BC", 5, 0),
      result("A-BD", 5, 0),
      result("A-CD", 0, 0)
    ]);

    expect(standings).toHaveLength(1);
    expect(standings[0]?.status).toBe("resolved");
    expect(standings[0]?.rows.map((row) => row.teamCode)).toEqual(["A1", "A2", "A3", "A4"]);
    expect(standings[0]?.rows.map((row) => row.points)).toEqual([6, 6, 4, 1]);
    expect(standings[0]?.rows.map((row) => row.goalDifference)).toEqual([-2, 9, -1, -6]);
  });

  test("uses reviewed official tiebreaker order for current score-identical Group C rows", () => {
    const standings = computeFifaGroupStandings(seedGroupMatches("C"), [
      result("wc2026-006", 1, 1),
      result("wc2026-007", 0, 1)
    ]);

    expect(standings[0]?.status).toBe("resolved");
    expect(standings[0]?.rows.map((row) => row.teamCode)).toEqual([
      "SCO",
      "MAR",
      "BRA",
      "HAI"
    ]);
    expect(standings[0]?.rows.map((row) => row.tiebreakerStatus)).toEqual([
      "resolved",
      "resolved",
      "resolved",
      "resolved"
    ]);
  });

  test("uses reviewed official tiebreaker order for current score-identical Group G rows", () => {
    const standings = computeFifaGroupStandings(seedGroupMatches("G"), [
      result("wc2026-014", 1, 1),
      result("wc2026-016", 2, 2)
    ]);

    expect(standings[0]?.status).toBe("resolved");
    expect(standings[0]?.rows.map((row) => row.teamCode)).toEqual([
      "NZL",
      "IRN",
      "BEL",
      "EGY"
    ]);
    expect(standings[0]?.rows.map((row) => row.tiebreakerStatus)).toEqual([
      "resolved",
      "resolved",
      "resolved",
      "resolved"
    ]);
  });

  test("uses reviewed official tiebreaker order for current score-identical Group H rows", () => {
    const standings = computeFifaGroupStandings(seedGroupMatches("H"), [
      result("wc2026-013", 0, 0),
      result("wc2026-015", 1, 1)
    ]);

    expect(standings[0]?.status).toBe("resolved");
    expect(standings[0]?.rows.map((row) => row.teamCode)).toEqual([
      "URU",
      "KSA",
      "ESP",
      "CPV"
    ]);
    expect(standings[0]?.rows.map((row) => row.tiebreakerStatus)).toEqual([
      "resolved",
      "resolved",
      "resolved",
      "resolved"
    ]);
  });

  test("does not reuse a reviewed tiebreaker order after the guarded row stats change", () => {
    const standings = computeFifaGroupStandings(seedGroupMatches("C"), [
      result("wc2026-006", 1, 1),
      result("wc2026-007", 0, 1),
      result("wc2026-030", 0, 0),
      result("wc2026-031", 0, 0)
    ]);
    const tiedRows = standings[0]?.rows.filter((row) => ["BRA", "MAR"].includes(row.teamCode));

    expect(standings[0]?.status).toBe("needs-manual-tiebreaker");
    expect(tiedRows?.map((row) => row.tiebreakerStatus)).toEqual([
      "needs-manual-tiebreaker",
      "needs-manual-tiebreaker"
    ]);
  });
});

describe("resolveAnnexCThirdPlaceAssignments", () => {
  test("resolves FIFA Annexe C option 1 for third-place groups E through L", () => {
    expect(resolveAnnexCThirdPlaceAssignments(["E", "F", "G", "H", "I", "J", "K", "L"])).toEqual({
      option: 1,
      assignments: {
        "1A": "3E",
        "1B": "3J",
        "1D": "3I",
        "1E": "3F",
        "1G": "3H",
        "1I": "3G",
        "1K": "3L",
        "1L": "3K"
      }
    });
  });

  test("contains every official eight third-place group combination exactly once", () => {
    const keys = FIFA_2026_ANNEX_C_ROWS.map((row) =>
      [...row.assignments].toSorted().join("")
    );

    expect(FIFA_2026_ANNEX_C_ROWS).toHaveLength(495);
    expect(new Set(keys)).toHaveLength(495);
  });

  test("keeps every assignment inside FIFA's allowed third-place pools", () => {
    for (const row of FIFA_2026_ANNEX_C_ROWS) {
      for (const [index, winnerSlot] of FIFA_2026_ANNEX_C_COLUMNS.entries()) {
        const assignedGroup = row.assignments[index];

        expect(assignedGroup).toBeDefined();
        expect(`1${assignedGroup}`).not.toBe(winnerSlot);
        expect(FIFA_2026_ROUND_OF_32_THIRD_PLACE_ALLOWED_GROUPS[winnerSlot]).toContain(
          assignedGroup
        );
      }
    }
  });
});

describe("resolveWorldCup2026RoundOf32", () => {
  test("refuses to resolve knockout slots before every group result is present", () => {
    expect(() => resolveWorldCup2026RoundOf32(allGroupMatches(), [])).toThrow(
      "Cannot resolve World Cup 2026 round of 32 before all group results are available (0/72)."
    );
  });

  test("builds fixed and Annexe C round-of-32 slots from complete group results", () => {
    const matches = allGroupMatches();
    const results = matches.map((match) => result(match.id, scoreForMatch(match), 0));
    const fixtures = resolveWorldCup2026RoundOf32(matches, results);

    expect(fixtures.map((fixture) => [fixture.matchNumber, fixture.homeSlot, fixture.awaySlot])).toEqual([
      [73, "2A", "2B"],
      [74, "1E", "3F"],
      [75, "1F", "2C"],
      [76, "1C", "2F"],
      [77, "1I", "3G"],
      [78, "2E", "2I"],
      [79, "1A", "3E"],
      [80, "1L", "3K"],
      [81, "1D", "3I"],
      [82, "1G", "3H"],
      [83, "2K", "2L"],
      [84, "1H", "2J"],
      [85, "1B", "3J"],
      [86, "1J", "2H"],
      [87, "1K", "3L"],
      [88, "2D", "2G"]
    ]);
  });

  test("resolves a golden round-of-32 bracket from the reviewed current match seed", () => {
    const fixtures = resolveWorldCup2026RoundOf32(
      WORLD_CUP_2026_SEED.matches,
      currentSeedProofResults()
    );

    expect(
      fixtures.map((fixture) => [
        fixture.matchNumber,
        fixture.homeSlot,
        fixture.homeTeam.code,
        fixture.awaySlot,
        fixture.awayTeam.code
      ])
    ).toEqual([
      [73, "2A", "RSA", "2B", "BIH"],
      [74, "1E", "GER", "3F", "SWE"],
      [75, "1F", "NED", "2C", "MAR"],
      [76, "1C", "BRA", "2F", "JPN"],
      [77, "1I", "FRA", "3G", "IRN"],
      [78, "2E", "CUW", "2I", "SEN"],
      [79, "1A", "MEX", "3E", "CIV"],
      [80, "1L", "ENG", "3K", "UZB"],
      [81, "1D", "USA", "3I", "IRQ"],
      [82, "1G", "BEL", "3H", "KSA"],
      [83, "2K", "COD", "2L", "CRO"],
      [84, "1H", "ESP", "2J", "ALG"],
      [85, "1B", "CAN", "3J", "AUT"],
      [86, "1J", "ARG", "2H", "CPV"],
      [87, "1K", "POR", "3L", "GHA"],
      [88, "2D", "PAR", "2G", "EGY"]
    ]);
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

function allGroupMatches(): WorldCupGroupMatch[] {
  return "ABCDEFGHIJKL".split("").flatMap((group) => groupMatches(group));
}

function seedGroupMatches(group: string): WorldCupGroupMatch[] {
  return WORLD_CUP_2026_SEED.matches.filter(isGroupStageMatch).filter(
    (matchFixture) => matchFixture.group === group
  );
}

function groupMatches(group: string): WorldCupGroupMatch[] {
  const teams = [1, 2, 3, 4].map((position) =>
    team(`${group}${position}`, `Group ${group} Team ${position}`)
  );

  return [
    match(`${group}-AB`, 1, group, teams[0], teams[1]),
    match(`${group}-AC`, 2, group, teams[0], teams[2]),
    match(`${group}-AD`, 3, group, teams[0], teams[3]),
    match(`${group}-BC`, 4, group, teams[1], teams[2]),
    match(`${group}-BD`, 5, group, teams[1], teams[3]),
    match(`${group}-CD`, 6, group, teams[2], teams[3])
  ];
}

function scoreForMatch(match: WorldCupGroupMatch): number {
  if (match.homeTeam.code.endsWith("1")) {
    if (match.group < "E" && match.id.endsWith("AC")) {
      return 5;
    }

    return 3;
  }

  if (match.homeTeam.code.endsWith("2")) {
    if (match.group < "E" && match.id.endsWith("BC")) {
      return 5;
    }

    return 2;
  }

  if (match.homeTeam.code.endsWith("3")) {
    return 1;
  }

  return 0;
}

function result(matchId: string, homeScore: number, awayScore: number): StandingsResult {
  return { matchId, homeScore, awayScore };
}

function match(
  id: string,
  matchNumber: number,
  group: string,
  homeTeam: WorldCupTeam | undefined,
  awayTeam: WorldCupTeam | undefined
): WorldCupGroupMatch {
  if (!homeTeam || !awayTeam) {
    throw new Error(`Missing teams for ${id}`);
  }

  return {
    id,
    matchNumber: group.charCodeAt(0) * 10 + matchNumber,
    phase: "group",
    group,
    homeTeam,
    awayTeam,
    localDate: "2026-06-11",
    kickoffTimeLocal: "13:00",
    kickoffAtUtc: "2026-06-11T19:00:00.000Z",
    venue: "Test Stadium",
    sourceId: "test-source",
    externalIds: {}
  };
}

function team(code: string, name: string): WorldCupTeam {
  return { code, name };
}
