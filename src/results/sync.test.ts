import { describe, expect, test, vi } from "vitest";

import { syncFinishedResults } from "./sync.js";
import type { StoredResult } from "../storage/database.js";
import type { WorldCupMatch } from "../worldcup/types.js";

describe("syncFinishedResults", () => {
  test("stores finished provider scores for matches with matching external ids", async () => {
    const upsertResult = vi.fn();
    const insertScoringRun = vi.fn();

    const result = await syncFinishedResults({
      enabled: true,
      token: "football-data-token",
      matches: [{ ...match("wc2026-001"), externalIds: { footballData: 12345 } }],
      dateFrom: "2026-06-11",
      dateTo: "2026-06-12",
      now: () => new Date("2026-06-11T23:01:00.000Z"),
      fetchMatches: async () => ({
        ok: true,
        matches: [
          {
            externalMatchId: "12345",
            kickoffAtUtc: "2026-06-11T19:00:00.000Z",
            status: "FINISHED",
            fullTime: { homeScore: 2, awayScore: 1 }
          }
        ]
      }),
      listResults: () => [],
      listPredictions: () => [],
      upsertResult,
      insertScoringRun
    });

    expect(result).toEqual({
      action: "synced",
      storedResults: ["wc2026-001"],
      skipped: []
    });
    expect(upsertResult).toHaveBeenCalledWith({
      matchId: "wc2026-001",
      homeScore: 2,
      awayScore: 1,
      recordedAt: "2026-06-11T23:01:00.000Z",
      resultSource: "football-data",
      externalMatchId: "12345",
      fetchedAt: "2026-06-11T23:01:00.000Z"
    });
    expect(insertScoringRun).toHaveBeenCalledWith({
      createdAt: "2026-06-11T23:01:00.000Z",
      matchId: null,
      summary: {
        storedResults: ["wc2026-001"],
        scoredPredictions: 0
      }
    });
  });

  test("does not overwrite existing manual results", async () => {
    const upsertResult = vi.fn();

    await expect(
      syncFinishedResults({
        enabled: true,
        token: "football-data-token",
        matches: [{ ...match("wc2026-001"), externalIds: { footballData: 12345 } }],
        dateFrom: "2026-06-11",
        dateTo: "2026-06-12",
        now: () => new Date("2026-06-11T23:01:00.000Z"),
        fetchMatches: async () => ({
          ok: true,
          matches: [
            {
              externalMatchId: "12345",
              kickoffAtUtc: "2026-06-11T19:00:00.000Z",
              status: "FINISHED",
              fullTime: { homeScore: 2, awayScore: 1 }
            }
          ]
        }),
        listResults: () => [manualResult("wc2026-001")],
        listPredictions: () => [],
        upsertResult,
        insertScoringRun: vi.fn()
      })
    ).resolves.toEqual({
      action: "synced",
      storedResults: [],
      skipped: ["wc2026-001"]
    });
    expect(upsertResult).not.toHaveBeenCalled();
  });

  test("returns provider failures without storing results", async () => {
    const upsertResult = vi.fn();

    await expect(
      syncFinishedResults({
        enabled: true,
        token: "football-data-token",
        matches: [],
        dateFrom: "2026-06-11",
        dateTo: "2026-06-12",
        now: () => new Date("2026-06-11T23:01:00.000Z"),
        fetchMatches: async () => ({ ok: false, reason: "rate-limited" }),
        listResults: () => [],
        listPredictions: () => [],
        upsertResult,
        insertScoringRun: vi.fn()
      })
    ).resolves.toEqual({ action: "failed", reason: "rate-limited" });
    expect(upsertResult).not.toHaveBeenCalled();
  });
});

function match(id: string): WorldCupMatch {
  return {
    id,
    matchNumber: 1,
    phase: "group",
    group: "A",
    homeTeam: { code: "MEX", name: "Mexico" },
    awayTeam: { code: "RSA", name: "South Africa" },
    localDate: "2026-06-11",
    kickoffTimeLocal: null,
    kickoffAtUtc: "2026-06-11T19:00:00.000Z",
    venue: "Test Stadium",
    sourceId: "test-source",
    externalIds: {}
  };
}

function manualResult(matchId: string): StoredResult {
  return {
    matchId,
    homeScore: 3,
    awayScore: 1,
    recordedAt: "2026-06-11T23:00:00.000Z",
    resultSource: "manual",
    externalMatchId: null,
    fetchedAt: null
  };
}
