import { describe, expect, test } from "vitest";

import { buildChaosDashboardModel, createWeeklySnapshotRows, weekStartKey } from "./stats.js";
import type { ScorePrediction, MatchResult } from "../scoring/scoring.js";
import type { WorldCupMatch } from "../worldcup/types.js";

describe("chaos dashboard stats", () => {
  test("builds people awards, match chaos, and top rows from scored results", () => {
    const avatarDataUri = "data:image/png;base64,leader-avatar";
    const model = buildChaosDashboardModel({
      matches: fixtureMatches,
      predictions: fixturePredictions,
      results: fixtureResults,
      displayNames: new Map([
        ["user-a", "Guibexa"],
        ["user-b", "SEVERAO DO HEXA"],
        ["user-c", "Anghexa"]
      ]),
      avatarDataUris: new Map([["user-a", avatarDataUri]]),
      previousWeekRows: [],
      now: new Date("2026-06-24T15:30:00.000Z"),
      timeZone: "America/Sao_Paulo"
    });

    expect(model.title).toBe("Copanalhas Recap");
    expect(model.week).toMatchObject({
      start: "2026-06-22",
      end: "2026-06-28",
      label: "2026-06-22..2026-06-28"
    });
    expect(model.totals).toEqual({
      scoredMatches: 2,
      predictions: 8,
      finishedPredictions: 6
    });
    expect(model.leaderboardTop[0]).toMatchObject({
      userId: "user-a",
      displayName: "Guibexa",
      points: 5,
      soloCount: 1
    });
    expect(model.leaderOfWeek).toMatchObject({
      userId: "user-a",
      displayName: "Guibexa",
      points: 5,
      avatarDataUri
    });
    expect(model.peopleAwards.map((award) => award.key)).toContain("profeta-isolado");
    expect(model.matchAwards.map((award) => award.key)).toContain("consenso-burro");
  });

  test("uses a Monday calendar week in the configured local timezone", () => {
    expect(weekStartKey(new Date("2026-06-22T03:00:00.000Z"), "America/Sao_Paulo")).toBe(
      "2026-06-22"
    );
    expect(weekStartKey(new Date("2026-06-22T02:59:59.000Z"), "America/Sao_Paulo")).toBe(
      "2026-06-15"
    );
  });

  test("renders no-history weekly movement when no baseline exists", () => {
    const model = buildChaosDashboardModel({
      matches: fixtureMatches,
      predictions: fixturePredictions,
      results: fixtureResults,
      displayNames: new Map(),
      previousWeekRows: [],
      now: new Date("2026-06-24T15:30:00.000Z"),
      timeZone: "UTC"
    });

    expect(model.weeklyMovement.status).toBe("no-history");
  });

  test("computes weekly climbers and fallers from a baseline", () => {
    const model = buildChaosDashboardModel({
      matches: fixtureMatches,
      predictions: fixturePredictions,
      results: fixtureResults,
      displayNames: new Map(),
      previousWeekRows: [
        {
          userId: "user-a",
          rank: 3,
          points: 0,
          soloCount: 0,
          exactCount: 0,
          outcomeCount: 0,
          closestCount: 0
        },
        {
          userId: "user-b",
          rank: 1,
          points: 3,
          soloCount: 0,
          exactCount: 1,
          outcomeCount: 0,
          closestCount: 0
        },
        {
          userId: "user-c",
          rank: 2,
          points: 2,
          soloCount: 0,
          exactCount: 0,
          outcomeCount: 1,
          closestCount: 0
        }
      ],
      now: new Date("2026-06-24T15:30:00.000Z"),
      timeZone: "UTC"
    });

    expect(model.weeklyMovement.status).toBe("ready");
    if (model.weeklyMovement.status !== "ready") {
      throw new Error("expected weekly movement to be ready");
    }
    expect(model.weeklyMovement.climbers[0]).toMatchObject({
      userId: "user-a",
      movement: 2
    });
    expect(model.weeklyMovement.fallers[0]).toMatchObject({
      userId: "user-b",
      movement: -2
    });
  });

  test("promotes data-specific people awards when weekly movement has stronger stories", () => {
    const model = buildChaosDashboardModel({
      matches: fixtureMatches,
      predictions: fixturePredictions,
      results: fixtureResults,
      displayNames: new Map([
        ["user-a", "Guibexa"],
        ["user-b", "SEVERAO DO HEXA"],
        ["user-c", "Anghexa"]
      ]),
      previousWeekRows: [
        {
          userId: "user-a",
          rank: 3,
          points: 0,
          soloCount: 0,
          exactCount: 0,
          outcomeCount: 0,
          closestCount: 0
        },
        {
          userId: "user-b",
          rank: 1,
          points: 3,
          soloCount: 0,
          exactCount: 1,
          outcomeCount: 0,
          closestCount: 0
        },
        {
          userId: "user-c",
          rank: 2,
          points: 2,
          soloCount: 0,
          exactCount: 0,
          outcomeCount: 1,
          closestCount: 0
        }
      ],
      now: new Date("2026-06-24T15:30:00.000Z"),
      timeZone: "UTC"
    });

    expect(model.peopleAwards).toHaveLength(8);
    expect(model.peopleAwards.map((award) => award.key)).toEqual(
      expect.arrayContaining(["foguete-da-semana", "escorregador-da-semana"])
    );
    expect(model.peopleAwards.find((award) => award.key === "foguete-da-semana")).toMatchObject({
      subject: "Guibexa",
      value: "+2 posicoes"
    });
  });

  test("creates weekly snapshot rows using shared leaderboard ranks", () => {
    expect(
      createWeeklySnapshotRows([
        {
          userId: "user-a",
          points: 5,
          soloCount: 1,
          exactCount: 0,
          outcomeCount: 0,
          closestCount: 0,
          matchesScored: 1
        },
        {
          userId: "user-b",
          points: 5,
          soloCount: 1,
          exactCount: 0,
          outcomeCount: 0,
          closestCount: 0,
          matchesScored: 1
        },
        {
          userId: "user-c",
          points: 2,
          soloCount: 0,
          exactCount: 0,
          outcomeCount: 1,
          closestCount: 0,
          matchesScored: 1
        }
      ]).map((row) => ({ userId: row.userId, rank: row.rank }))
    ).toEqual([
      { userId: "user-a", rank: 1 },
      { userId: "user-b", rank: 1 },
      { userId: "user-c", rank: 3 }
    ]);
  });
});

const fixtureMatches: WorldCupMatch[] = [
  match("match-1", 1, "BRA", "Brazil", "JPN", "Japan"),
  match("match-2", 2, "GER", "Germany", "SCO", "Scotland"),
  match("match-3", 3, "MEX", "Mexico", "ESP", "Spain")
];

const fixturePredictions: ScorePrediction[] = [
  { userId: "user-a", matchId: "match-1", homeScore: 2, awayScore: 1 },
  { userId: "user-b", matchId: "match-1", homeScore: 1, awayScore: 0 },
  { userId: "user-c", matchId: "match-1", homeScore: 0, awayScore: 1 },
  { userId: "user-a", matchId: "match-2", homeScore: 2, awayScore: 0 },
  { userId: "user-b", matchId: "match-2", homeScore: 2, awayScore: 0 },
  { userId: "user-c", matchId: "match-2", homeScore: 0, awayScore: 1 },
  { userId: "user-a", matchId: "match-3", homeScore: 4, awayScore: 3 },
  { userId: "user-b", matchId: "match-3", homeScore: 4, awayScore: 3 }
];

const fixtureResults: MatchResult[] = [
  { matchId: "match-1", homeScore: 2, awayScore: 1 },
  { matchId: "match-2", homeScore: 0, awayScore: 1 }
];

function match(
  id: string,
  matchNumber: number,
  homeCode: string,
  homeName: string,
  awayCode: string,
  awayName: string
): WorldCupMatch {
  return {
    id,
    matchNumber,
    phase: "group",
    group: "A",
    homeTeam: { code: homeCode, name: homeName },
    awayTeam: { code: awayCode, name: awayName },
    localDate: "2026-06-11",
    kickoffTimeLocal: "13:00",
    kickoffAtUtc: "2026-06-11T16:00:00.000Z",
    venue: "Test Stadium",
    sourceId: "test",
    externalIds: {}
  };
}
