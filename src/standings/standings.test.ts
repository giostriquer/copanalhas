import { describe, expect, test } from "vitest";

import { computeGroupStandings } from "./standings.js";
import type { StoredResult } from "../storage/database.js";
import type { WorldCupMatch, WorldCupTeam } from "../worldcup/types.js";

describe("computeGroupStandings", () => {
  test("creates empty rows for teams from group fixtures", () => {
    const [firstMatch] = groupAFixtures();

    if (!firstMatch) {
      throw new Error("test fixtures need at least one match");
    }

    expect(computeGroupStandings([firstMatch], [])).toEqual([
      {
        group: "A",
        rows: [
          emptyRow({ rank: 1, teamCode: "MEX", teamName: "Mexico" }),
          emptyRow({ rank: 2, teamCode: "RSA", teamName: "South Africa" })
        ]
      }
    ]);
  });

  test("computes points and goal records from stored final results", () => {
    const standings = computeGroupStandings(groupAFixtures(), [
      result("wc2026-test-001", 2, 1),
      result("wc2026-test-002", 0, 0)
    ]);

    expect(standings).toHaveLength(1);
    expect(standings[0]?.rows).toEqual([
      {
        rank: 1,
        group: "A",
        teamCode: "MEX",
        teamName: "Mexico",
        played: 1,
        wins: 1,
        draws: 0,
        losses: 0,
        goalsFor: 2,
        goalsAgainst: 1,
        goalDifference: 1,
        points: 3
      },
      {
        rank: 2,
        group: "A",
        teamCode: "BRA",
        teamName: "Brazil",
        played: 1,
        wins: 0,
        draws: 1,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        points: 1
      },
      {
        rank: 3,
        group: "A",
        teamCode: "CAN",
        teamName: "Canada",
        played: 1,
        wins: 0,
        draws: 1,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        points: 1
      },
      {
        rank: 4,
        group: "A",
        teamCode: "RSA",
        teamName: "South Africa",
        played: 1,
        wins: 0,
        draws: 0,
        losses: 1,
        goalsFor: 1,
        goalsAgainst: 2,
        goalDifference: -1,
        points: 0
      }
    ]);
  });

  test("uses deterministic tie sorting by points, goal difference, goals for, then name", () => {
    const standings = computeGroupStandings(groupAFixtures(), [
      result("wc2026-test-001", 2, 0),
      result("wc2026-test-002", 3, 1)
    ]);

    expect(standings[0]?.rows.map((row) => row.teamName)).toEqual([
      "Brazil",
      "Mexico",
      "Canada",
      "South Africa"
    ]);
  });

  test("ignores result records that do not match a loaded fixture", () => {
    const standings = computeGroupStandings(groupAFixtures(), [
      result("wc2026-test-999", 9, 0)
    ]);

    expect(standings[0]?.rows.map((row) => row.points)).toEqual([0, 0, 0, 0]);
  });
});

function groupAFixtures(): WorldCupMatch[] {
  return [
    match("wc2026-test-001", 1, "A", team("MEX", "Mexico"), team("RSA", "South Africa")),
    match("wc2026-test-002", 2, "A", team("BRA", "Brazil"), team("CAN", "Canada"))
  ];
}

function emptyRow(overrides: { rank: number; teamCode: string; teamName: string }) {
  return {
    rank: overrides.rank,
    group: "A",
    teamCode: overrides.teamCode,
    teamName: overrides.teamName,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0
  };
}

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

function match(
  id: string,
  matchNumber: number,
  group: string,
  homeTeam: WorldCupTeam,
  awayTeam: WorldCupTeam
): WorldCupMatch {
  return {
    id,
    matchNumber,
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
