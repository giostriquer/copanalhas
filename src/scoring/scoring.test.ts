import { describe, expect, test } from "vitest";

import { buildLeaderboard, scoreMatch } from "./scoring.js";

describe("scoreMatch", () => {
  test("awards 5 solo points when exactly one member lands the exact scoreline", () => {
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
        points: 5,
        distance: 0,
        awards: ["solo"]
      },
      {
        userId: "u2",
        matchId: "match-1",
        points: 0,
        distance: 1,
        awards: []
      }
    ]);
  });

  test("awards 3 exact points each when multiple members land the exact scoreline", () => {
    const scored = scoreMatch(
      { matchId: "match-1", homeScore: 2, awayScore: 1 },
      [
        prediction("u1", "match-1", 2, 1),
        prediction("u2", "match-1", 2, 1),
        prediction("u3", "match-1", 2, 0)
      ]
    );

    expect(pointsByUser(scored)).toEqual({
      u1: 3,
      u2: 3,
      u3: 0
    });
  });

  test("awards closest prediction when nobody lands the exact score", () => {
    const scored = scoreMatch(
      { matchId: "match-1", homeScore: 3, awayScore: 2 },
      [
        prediction("u1", "match-1", 1, 1),
        prediction("u2", "match-1", 2, 2),
        prediction("u3", "match-1", 0, 0)
      ]
    );

    expect(pointsByUser(scored)).toEqual({
      u1: 0,
      u2: 1,
      u3: 0
    });
  });

  test("breaks closest ties by total goals difference", () => {
    const scored = scoreMatch(
      { matchId: "match-1", homeScore: 1, awayScore: 1 },
      [
        prediction("u1", "match-1", 3, 1),
        prediction("u2", "match-1", 2, 0),
        prediction("u3", "match-1", 2, 0),
        prediction("u4", "match-1", 3, 0)
      ]
    );

    expect(pointsByUser(scored)).toEqual({
      u1: 0,
      u2: 1,
      u3: 1,
      u4: 0
    });
    expect(awardsByUser(scored)).toEqual({
      u1: [],
      u2: ["closest"],
      u3: ["closest"],
      u4: []
    });
  });

  test("awards all correct winner predictions when nobody lands the exact score", () => {
    const scored = scoreMatch(
      { matchId: "match-1", homeScore: 3, awayScore: 1 },
      [
        prediction("u1", "match-1", 1, 0),
        prediction("u2", "match-1", 4, 2),
        prediction("u3", "match-1", 2, 2),
        prediction("u4", "match-1", 0, 1)
      ]
    );

    expect(scored).toEqual([
      {
        userId: "u1",
        matchId: "match-1",
        points: 2,
        distance: 3,
        awards: ["outcome"]
      },
      {
        userId: "u2",
        matchId: "match-1",
        points: 2,
        distance: 2,
        awards: ["outcome"]
      },
      {
        userId: "u3",
        matchId: "match-1",
        points: 0,
        distance: 2,
        awards: []
      },
      {
        userId: "u4",
        matchId: "match-1",
        points: 0,
        distance: 3,
        awards: []
      }
    ]);
  });

  test("awards all correct draw predictions when nobody lands the exact score", () => {
    const scored = scoreMatch(
      { matchId: "match-1", homeScore: 0, awayScore: 0 },
      [
        prediction("u1", "match-1", 2, 2),
        prediction("u2", "match-1", 1, 1),
        prediction("u3", "match-1", 1, 0)
      ]
    );

    expect(pointsByUser(scored)).toEqual({
      u1: 2,
      u2: 2,
      u3: 0
    });
  });

  test("does not award closest points when any correct outcome prediction exists", () => {
    const scored = scoreMatch(
      { matchId: "match-1", homeScore: 4, awayScore: 1 },
      [
        prediction("u1", "match-1", 4, 2),
        prediction("u2", "match-1", 1, 0),
        prediction("u3", "match-1", 3, 3)
      ]
    );

    expect(pointsByUser(scored)).toEqual({
      u1: 2,
      u2: 2,
      u3: 0
    });
    expect(awardsByUser(scored)).toEqual({
      u1: ["outcome"],
      u2: ["outcome"],
      u3: []
    });
  });

  test("does not award closest points when any exact prediction exists", () => {
    const scored = scoreMatch(
      { matchId: "match-1", homeScore: 1, awayScore: 0 },
      [
        prediction("u1", "match-1", 1, 0),
        prediction("u2", "match-1", 2, 0),
        prediction("u3", "match-1", 5, 5)
      ]
    );

    expect(pointsByUser(scored)).toEqual({
      u1: 5,
      u2: 0,
      u3: 0
    });
  });

  test("awards all tied closest predictions", () => {
    const scored = scoreMatch(
      { matchId: "match-1", homeScore: 2, awayScore: 2 },
      [
        prediction("u1", "match-1", 3, 2),
        prediction("u2", "match-1", 2, 3),
        prediction("u3", "match-1", 4, 0)
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

  test("stacks decision-method bonus on knockout regular-time solo exact", () => {
    const scored = scoreMatch(
      knockoutResult({
        matchId: "ko-1",
        homeScore: 2,
        awayScore: 1,
        decisionMethod: "regular",
        regularTimeHomeScore: 2,
        regularTimeAwayScore: 1,
        winner: "home"
      }),
      [
        prediction("u1", "ko-1", 2, 1, "regular"),
        prediction("u2", "ko-1", 3, 2, "regular"),
        prediction("u3", "ko-1", 1, 1, "extra_time")
      ]
    );

    expect(pointsByUser(scored)).toEqual({
      u1: 7,
      u2: 2,
      u3: 0
    });
    expect(awardsByUser(scored)).toEqual({
      u1: ["solo", "decision_bonus"],
      u2: ["decision_bonus"],
      u3: []
    });
  });

  test("awards shared knockout regular-time exact before later tiers", () => {
    const scored = scoreMatch(
      knockoutResult({
        matchId: "ko-1",
        homeScore: 2,
        awayScore: 1,
        decisionMethod: "regular",
        regularTimeHomeScore: 2,
        regularTimeAwayScore: 1,
        winner: "home"
      }),
      [
        prediction("u1", "ko-1", 2, 1, "regular"),
        prediction("u2", "ko-1", 2, 1, "regular"),
        prediction("u3", "ko-1", 4, 0, "regular")
      ]
    );

    expect(pointsByUser(scored)).toEqual({
      u1: 5,
      u2: 5,
      u3: 2
    });
    expect(awardsByUser(scored)).toEqual({
      u1: ["exact", "decision_bonus"],
      u2: ["exact", "decision_bonus"],
      u3: ["decision_bonus"]
    });
  });

  test("uses extra-time exact when nobody hits regular-time exact", () => {
    const scored = scoreMatch(
      knockoutResult({
        matchId: "ko-1",
        homeScore: 2,
        awayScore: 1,
        decisionMethod: "extra_time",
        regularTimeHomeScore: 1,
        regularTimeAwayScore: 1,
        extraTimeHomeScore: 2,
        extraTimeAwayScore: 1,
        winner: "home"
      }),
      [
        prediction("u1", "ko-1", 2, 1, "extra_time"),
        prediction("u2", "ko-1", 0, 0, "extra_time"),
        prediction("u3", "ko-1", 2, 0, "regular")
      ]
    );

    expect(pointsByUser(scored)).toEqual({
      u1: 5,
      u2: 2,
      u3: 0
    });
    expect(awardsByUser(scored)).toEqual({
      u1: ["exact", "decision_bonus"],
      u2: ["decision_bonus"],
      u3: []
    });
  });

  test("does not stack extra-time exact when regular-time exact already scored", () => {
    const scored = scoreMatch(
      knockoutResult({
        matchId: "ko-1",
        homeScore: 2,
        awayScore: 1,
        decisionMethod: "extra_time",
        regularTimeHomeScore: 1,
        regularTimeAwayScore: 1,
        extraTimeHomeScore: 2,
        extraTimeAwayScore: 1,
        winner: "home"
      }),
      [
        prediction("u1", "ko-1", 1, 1, "extra_time"),
        prediction("u2", "ko-1", 2, 1, "extra_time"),
        prediction("u3", "ko-1", 0, 0, "extra_time")
      ]
    );

    expect(pointsByUser(scored)).toEqual({
      u1: 7,
      u2: 2,
      u3: 2
    });
    expect(awardsByUser(scored)).toEqual({
      u1: ["solo", "decision_bonus"],
      u2: ["decision_bonus"],
      u3: ["decision_bonus"]
    });
  });

  test("awards result points after extra time when nobody hits an exact score", () => {
    const scored = scoreMatch(
      knockoutResult({
        matchId: "ko-1",
        homeScore: 3,
        awayScore: 2,
        decisionMethod: "extra_time",
        regularTimeHomeScore: 2,
        regularTimeAwayScore: 2,
        extraTimeHomeScore: 3,
        extraTimeAwayScore: 2,
        winner: "home"
      }),
      [
        prediction("u1", "ko-1", 2, 1, "extra_time"),
        prediction("u2", "ko-1", 2, 1, "regular"),
        prediction("u3", "ko-1", 1, 2, "extra_time")
      ]
    );

    expect(pointsByUser(scored)).toEqual({
      u1: 4,
      u2: 2,
      u3: 2
    });
    expect(awardsByUser(scored)).toEqual({
      u1: ["outcome", "decision_bonus"],
      u2: ["outcome"],
      u3: ["decision_bonus"]
    });
  });

  test("awards advancement-side points after penalties when nobody hits an exact phase", () => {
    const scored = scoreMatch(
      knockoutResult({
        matchId: "ko-1",
        homeScore: 6,
        awayScore: 5,
        decisionMethod: "penalties",
        regularTimeHomeScore: 0,
        regularTimeAwayScore: 0,
        extraTimeHomeScore: 1,
        extraTimeAwayScore: 1,
        penaltyHomeScore: 5,
        penaltyAwayScore: 4,
        winner: "home"
      }),
      [
        prediction("u1", "ko-1", 2, 1, "penalties"),
        prediction("u2", "ko-1", 2, 2, "penalties"),
        prediction("u3", "ko-1", 1, 2, "penalties"),
        prediction("u4", "ko-1", 3, 2, "regular")
      ]
    );

    expect(pointsByUser(scored)).toEqual({
      u1: 4,
      u2: 2,
      u3: 2,
      u4: 2
    });
    expect(awardsByUser(scored)).toEqual({
      u1: ["outcome", "decision_bonus"],
      u2: ["decision_bonus"],
      u3: ["decision_bonus"],
      u4: ["outcome"]
    });
  });

  test("uses result points for regular-time knockout finishes", () => {
    const scored = scoreMatch(
      knockoutResult({
        matchId: "ko-1",
        homeScore: 4,
        awayScore: 1,
        decisionMethod: "regular",
        regularTimeHomeScore: 4,
        regularTimeAwayScore: 1,
        winner: "home"
      }),
      [
        prediction("u1", "ko-1", 3, 1, "regular"),
        prediction("u2", "ko-1", 2, 2, "extra_time")
      ]
    );

    expect(pointsByUser(scored)).toEqual({
      u1: 4,
      u2: 0
    });
    expect(awardsByUser(scored)).toEqual({
      u1: ["outcome", "decision_bonus"],
      u2: []
    });
  });

  test("uses closest-score points for regular-time knockout finishes", () => {
    const scored = scoreMatch(
      knockoutResult({
        matchId: "ko-1",
        homeScore: 2,
        awayScore: 0,
        decisionMethod: "regular",
        regularTimeHomeScore: 2,
        regularTimeAwayScore: 0,
        winner: "home"
      }),
      [
        prediction("u1", "ko-1", 2, 2, "regular"),
        prediction("u2", "ko-1", 0, 1, "regular"),
        prediction("u3", "ko-1", 5, 5, "extra_time")
      ]
    );

    expect(pointsByUser(scored)).toEqual({
      u1: 3,
      u2: 2,
      u3: 0
    });
    expect(awardsByUser(scored)).toEqual({
      u1: ["closest", "decision_bonus"],
      u2: ["decision_bonus"],
      u3: []
    });
  });
});

describe("buildLeaderboard", () => {
  test("aggregates scored predictions and sorts by points, scoring tie-breakers, then user id", () => {
    const leaderboard = buildLeaderboard(
      [
        { userId: "u4", matchId: "m1", points: 1, distance: 1, awards: ["closest"] },
        { userId: "u3", matchId: "m1", points: 2, distance: 2, awards: ["outcome"] },
        { userId: "u2", matchId: "m1", points: 3, distance: 0, awards: ["exact"] },
        { userId: "u1", matchId: "m1", points: 5, distance: 0, awards: ["solo"] },
        { userId: "u2", matchId: "m2", points: 2, distance: 2, awards: ["outcome"] },
        { userId: "u3", matchId: "m2", points: 2, distance: 2, awards: ["outcome"] },
        { userId: "u3", matchId: "m3", points: 1, distance: 1, awards: ["closest"] },
        { userId: "u4", matchId: "m2", points: 1, distance: 1, awards: ["closest"] },
        { userId: "u4", matchId: "m3", points: 1, distance: 1, awards: ["closest"] },
        { userId: "u4", matchId: "m4", points: 1, distance: 1, awards: ["closest"] },
        { userId: "u4", matchId: "m5", points: 1, distance: 1, awards: ["closest"] },
        { userId: "u5", matchId: "m2", points: 2, distance: 2, awards: ["decision_bonus"] }
      ],
      [prediction("u5", "m1", 0, 0), prediction("u6", "m1", 0, 0)]
    );

    expect(leaderboard).toEqual([
      { userId: "u1", points: 5, soloCount: 1, exactCount: 0, outcomeCount: 0, closestCount: 0, decisionBonusCount: 0, matchesScored: 1 },
      { userId: "u2", points: 5, soloCount: 0, exactCount: 1, outcomeCount: 1, closestCount: 0, decisionBonusCount: 0, matchesScored: 2 },
      { userId: "u3", points: 5, soloCount: 0, exactCount: 0, outcomeCount: 2, closestCount: 1, decisionBonusCount: 0, matchesScored: 3 },
      { userId: "u4", points: 5, soloCount: 0, exactCount: 0, outcomeCount: 0, closestCount: 5, decisionBonusCount: 0, matchesScored: 5 },
      { userId: "u5", points: 2, soloCount: 0, exactCount: 0, outcomeCount: 0, closestCount: 0, decisionBonusCount: 1, matchesScored: 1 },
      { userId: "u6", points: 0, soloCount: 0, exactCount: 0, outcomeCount: 0, closestCount: 0, decisionBonusCount: 0, matchesScored: 0 }
    ]);
  });

  test("includes zero-point participants from predictions that have not been scored yet", () => {
    const leaderboard = buildLeaderboard(
      [
        { userId: "u2", matchId: "m1", points: 5, distance: 0, awards: ["solo"] }
      ],
      [
        prediction("u3", "m2", 1, 1),
        prediction("u1", "m3", 2, 0),
        prediction("u3", "m4", 0, 0)
      ]
    );

    expect(leaderboard).toEqual([
      { userId: "u2", points: 5, soloCount: 1, exactCount: 0, outcomeCount: 0, closestCount: 0, decisionBonusCount: 0, matchesScored: 1 },
      { userId: "u1", points: 0, soloCount: 0, exactCount: 0, outcomeCount: 0, closestCount: 0, decisionBonusCount: 0, matchesScored: 0 },
      { userId: "u3", points: 0, soloCount: 0, exactCount: 0, outcomeCount: 0, closestCount: 0, decisionBonusCount: 0, matchesScored: 0 }
    ]);
  });
});

function prediction(
  userId: string,
  matchId: string,
  homeScore: number,
  awayScore: number,
  decisionMethod: "regular" | "extra_time" | "penalties" | null = null
) {
  return { userId, matchId, homeScore, awayScore, decisionMethod };
}

function knockoutResult(overrides: {
  matchId: string;
  homeScore: number;
  awayScore: number;
  decisionMethod: "regular" | "extra_time" | "penalties";
  regularTimeHomeScore?: number;
  regularTimeAwayScore?: number;
  extraTimeHomeScore?: number;
  extraTimeAwayScore?: number;
  penaltyHomeScore?: number;
  penaltyAwayScore?: number;
  winner: "home" | "away";
}) {
  return {
    phase: "round_of_32" as const,
    ...overrides
  };
}

function pointsByUser(scored: Array<{ userId: string; points: number }>) {
  return Object.fromEntries(scored.map((row) => [row.userId, row.points]));
}

function awardsByUser(scored: Array<{ userId: string; awards: string[] }>) {
  return Object.fromEntries(scored.map((row) => [row.userId, row.awards]));
}
