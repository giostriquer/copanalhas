import { describe, expect, test } from "vitest";

import {
  FIFA_2026_ANNEX_C_COLUMNS,
  FIFA_2026_ANNEX_C_ROWS,
  FIFA_2026_ROUND_OF_32_THIRD_PLACE_ALLOWED_GROUPS,
  resolveAnnexCThirdPlaceAssignments,
  resolveWorldCup2026RoundOf32,
  computeFifaGroupStandings
} from "./fifa-qualification.js";
import type { StandingsResult } from "../standings/standings.js";
import type { WorldCupMatch, WorldCupTeam } from "./types.js";

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
});

function allGroupMatches(): WorldCupMatch[] {
  return "ABCDEFGHIJKL".split("").flatMap((group) => groupMatches(group));
}

function groupMatches(group: string): WorldCupMatch[] {
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

function scoreForMatch(match: WorldCupMatch): number {
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
): WorldCupMatch {
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
