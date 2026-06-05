import { describe, expect, test } from "vitest";

import { createLeaderboardDashboardMessage, formatLeaderboard } from "./format.js";

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

describe("createLeaderboardDashboardMessage", () => {
  test("renders an empty public dashboard message", () => {
    expect(
      createLeaderboardDashboardMessage({
        rows: [],
        updatedAt: new Date("2026-06-11T23:30:00.000Z"),
        timeZone: "UTC"
      })
    ).toEqual({
      content: [
        "Copanalhas Leaderboard",
        "Updated: 2026-06-11 23:30 UTC",
        "```text",
        "No scored matches yet.",
        "```"
      ].join("\n"),
      embeds: []
    });
  });

  test("renders ranked player rows in a compact table", () => {
    expect(
      createLeaderboardDashboardMessage({
        rows: [
          {
            userId: "user-1",
            points: 6,
            exactCount: 2,
            closestCount: 0,
            matchesScored: 2
          },
          {
            userId: "user-2",
            points: 1,
            exactCount: 0,
            closestCount: 1,
            matchesScored: 2
          }
        ],
        displayNames: new Map([
          ["user-1", "Giova"],
          ["user-2", "Ana"]
        ]),
        updatedAt: new Date("2026-06-11T23:30:00.000Z"),
        timeZone: "UTC"
      }).content
    ).toBe(
      [
        "Copanalhas Leaderboard",
        "Updated: 2026-06-11 23:30 UTC",
        "```text",
        "#  Player               Pts Exact Close Matches",
        "1  Giova                6     2     0       2",
        "2  Ana                  1     0     1       2",
        "```"
      ].join("\n")
    );
  });
});
