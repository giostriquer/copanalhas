import { describe, expect, test } from "vitest";

import { formatLeaderboard } from "./format.js";

describe("formatLeaderboard", () => {
  test("renders no-results output", () => {
    expect(formatLeaderboard([])).toBe("No leaderboard results yet.");
  });

  test("renders ranked leaderboard rows with display names", () => {
    expect(
      formatLeaderboard(
        [
          { userId: "u1", points: 4, exactCount: 1, closestCount: 1, matchesScored: 2 },
          { userId: "u2", points: 1, exactCount: 0, closestCount: 1, matchesScored: 1 }
        ],
        new Map([
          ["u1", "Alice"],
          ["u2", "Bob"]
        ])
      )
    ).toBe(
      [
        "Copanalhas Leaderboard",
        "1. Alice - 4 pts (1 exact, 1 closest, 2 matches)",
        "2. Bob - 1 pt (0 exact, 1 closest, 1 match)"
      ].join("\n")
    );
  });

  test("uses shared ranks for tied scores", () => {
    expect(
      formatLeaderboard([
        { userId: "u1", points: 3, exactCount: 1, closestCount: 0, matchesScored: 1 },
        { userId: "u2", points: 1, exactCount: 0, closestCount: 1, matchesScored: 1 },
        { userId: "u3", points: 1, exactCount: 0, closestCount: 1, matchesScored: 1 }
      ])
    ).toBe(
      [
        "Copanalhas Leaderboard",
        "1. u1 - 3 pts (1 exact, 0 closest, 1 match)",
        "2. u2 - 1 pt (0 exact, 1 closest, 1 match)",
        "2. u3 - 1 pt (0 exact, 1 closest, 1 match)"
      ].join("\n")
    );
  });
});
