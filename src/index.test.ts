import { describe, expect, test } from "vitest";

import { runCli } from "./index.js";

describe("runCli", () => {
  test("prints a leaderboard from stored predictions and results", () => {
    const lines: string[] = [];

    runCli(["leaderboard"], {
      openDatabase: () => ({
        migrate: () => undefined,
        listPredictions: () => [
          {
            userId: "u1",
            matchId: "wc2026-001",
            messageId: "m1",
            homeScore: 2,
            awayScore: 1,
            submittedAt: "2026-06-10T12:00:00.000Z",
            updatedAt: null,
            parserVersion: "prediction-parser-v1"
          },
          {
            userId: "u2",
            matchId: "wc2026-001",
            messageId: "m2",
            homeScore: 1,
            awayScore: 1,
            submittedAt: "2026-06-10T12:01:00.000Z",
            updatedAt: null,
            parserVersion: "prediction-parser-v1"
          }
        ],
        listResults: () => [
          {
            matchId: "wc2026-001",
            homeScore: 2,
            awayScore: 1,
            recordedAt: "2026-06-11T23:00:00.000Z"
          }
        ],
        close: () => undefined
      }),
      writeLine: (line) => lines.push(line),
      env: {}
    });

    expect(lines).toEqual([
      [
        "Copanalhas Leaderboard",
        "1. u1 - 3 pts (1 exact, 0 closest, 1 match)",
        "2. u2 - 1 pt (0 exact, 1 closest, 1 match)"
      ].join("\n")
    ]);
  });

  test("prints usage for unknown commands", () => {
    const lines: string[] = [];

    runCli(["wat"], {
      openDatabase: () => {
        throw new Error("database should not open");
      },
      writeLine: (line) => lines.push(line),
      env: {}
    });

    expect(lines).toEqual(["Usage: npm run dev -- leaderboard"]);
  });
});
