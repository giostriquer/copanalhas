import { describe, expect, test } from "vitest";

import { buildLeaderboard, scoreMatch } from "./scoring.js";

describe("scoreMatch", () => {
  test("awards 3 points for exact scoreline predictions", () => {
    const scored = scoreMatch(
      { matchId: "match-1", homeScore: 2, awayScore: 1 },
      [
        prediction("u1", "match-1", 2, 1),
        prediction("u2", "match-1", 1, 1)
      ]
    );

    expect(scored).toEqual([
      {
        userId: "u1",
        matchId: "match-1",
        points: 3,
        distance: 0,
        awards: ["exact"]
      },
      {
        userId: "u2",
        matchId: "match-1",
        points: 1,
        distance: 1,
        awards: ["closest"]
      }
    ]);
  });

  test("awards closest prediction when nobody lands the exact score", () => {
    const scored = scoreMatch(
      { matchId: "match-1", homeScore: 3, awayScore: 2 },
      [
        prediction("u1", "match-1", 1, 1),
        prediction("u2", "match-1", 3, 1),
        prediction("u3", "match-1", 0, 0)
      ]
    );

    expect(pointsByUser(scored)).toEqual({
      u1: 0,
      u2: 1,
      u3: 0
    });
  });

  test("awards closest non-exact prediction even when exact predictions exist", () => {
    const scored = scoreMatch(
      { matchId: "match-1", homeScore: 1, awayScore: 0 },
      [
        prediction("u1", "match-1", 1, 0),
        prediction("u2", "match-1", 2, 0),
        prediction("u3", "match-1", 5, 5)
      ]
    );

    expect(pointsByUser(scored)).toEqual({
      u1: 3,
      u2: 1,
      u3: 0
    });
  });

  test("awards all tied closest predictions", () => {
    const scored = scoreMatch(
      { matchId: "match-1", homeScore: 2, awayScore: 2 },
      [
        prediction("u1", "match-1", 2, 1),
        prediction("u2", "match-1", 1, 2),
        prediction("u3", "match-1", 0, 0)
      ]
    );

    expect(pointsByUser(scored)).toEqual({
      u1: 1,
      u2: 1,
      u3: 0
    });
  });

  test("ignores predictions for other matches", () => {
    const scored = scoreMatch(
      { matchId: "match-1", homeScore: 2, awayScore: 0 },
      [
        prediction("u1", "match-1", 2, 0),
        prediction("u2", "match-2", 2, 0)
      ]
    );

    expect(scored.map((row) => row.userId)).toEqual(["u1"]);
  });
});

describe("buildLeaderboard", () => {
  test("aggregates scored predictions and sorts by points then user id", () => {
    const leaderboard = buildLeaderboard([
      { userId: "u2", matchId: "m1", points: 1, distance: 1, awards: ["closest"] },
      { userId: "u1", matchId: "m1", points: 3, distance: 0, awards: ["exact"] },
      { userId: "u1", matchId: "m2", points: 1, distance: 1, awards: ["closest"] },
      { userId: "u3", matchId: "m1", points: 1, distance: 2, awards: [] }
    ]);

    expect(leaderboard).toEqual([
      { userId: "u1", points: 4, exactCount: 1, closestCount: 1, matchesScored: 2 },
      { userId: "u2", points: 1, exactCount: 0, closestCount: 1, matchesScored: 1 },
      { userId: "u3", points: 1, exactCount: 0, closestCount: 0, matchesScored: 1 }
    ]);
  });
});

function prediction(
  userId: string,
  matchId: string,
  homeScore: number,
  awayScore: number
) {
  return { userId, matchId, homeScore, awayScore };
}

function pointsByUser(scored: Array<{ userId: string; points: number }>) {
  return Object.fromEntries(scored.map((row) => [row.userId, row.points]));
}
