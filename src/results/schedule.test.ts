import { describe, expect, test } from "vitest";

import { planResultSyncAttempt } from "./schedule.js";
import type { StoredResult } from "../storage/database.js";
import type { WorldCupMatch } from "../worldcup/types.js";

describe("planResultSyncAttempt", () => {
  test("waits until a mapped unresolved match reaches its first check time", () => {
    expect(
      planResultSyncAttempt({
        matches: [match("wc2026-001", "2026-06-11T19:00:00.000Z", 537327)],
        results: [],
        now: new Date("2026-06-11T21:00:00.000Z"),
        firstCheckDelayMinutes: 135,
        retryIntervalMinutes: 30,
        lastAttemptAtUtc: null
      })
    ).toEqual({
      action: "not-due",
      nextCheckAtUtc: "2026-06-11T21:15:00.000Z",
      pendingMatchIds: ["wc2026-001"]
    });
  });

  test("plans one provider request for due unresolved matches", () => {
    expect(
      planResultSyncAttempt({
        matches: [
          match("wc2026-001", "2026-06-11T19:00:00.000Z", 537327),
          match("wc2026-002", "2026-06-12T02:00:00.000Z", 537328)
        ],
        results: [],
        now: new Date("2026-06-12T04:30:00.000Z"),
        firstCheckDelayMinutes: 135,
        retryIntervalMinutes: 30,
        lastAttemptAtUtc: null
      })
    ).toEqual({
      action: "due",
      dateFrom: "2026-06-11",
      dateTo: "2026-06-12",
      pendingMatchIds: ["wc2026-001", "wc2026-002"]
    });
  });

  test("respects retry cooldown after a provider attempt", () => {
    expect(
      planResultSyncAttempt({
        matches: [match("wc2026-001", "2026-06-11T19:00:00.000Z", 537327)],
        results: [],
        now: new Date("2026-06-11T21:20:00.000Z"),
        firstCheckDelayMinutes: 135,
        retryIntervalMinutes: 30,
        lastAttemptAtUtc: "2026-06-11T21:15:00.000Z"
      })
    ).toEqual({
      action: "not-due",
      nextCheckAtUtc: "2026-06-11T21:45:00.000Z",
      pendingMatchIds: ["wc2026-001"]
    });
  });

  test("ignores matches that are already resolved or missing provider ids", () => {
    expect(
      planResultSyncAttempt({
        matches: [
          match("wc2026-001", "2026-06-11T19:00:00.000Z", 537327),
          match("wc2026-002", "2026-06-12T02:00:00.000Z", undefined)
        ],
        results: [result("wc2026-001")],
        now: new Date("2026-06-12T04:30:00.000Z"),
        firstCheckDelayMinutes: 135,
        retryIntervalMinutes: 30,
        lastAttemptAtUtc: null
      })
    ).toEqual({
      action: "not-due",
      nextCheckAtUtc: null,
      pendingMatchIds: []
    });
  });
});

function match(
  id: string,
  kickoffAtUtc: string,
  footballDataId: number | undefined
): WorldCupMatch {
  return {
    id,
    matchNumber: Number(id.slice(-3)),
    phase: "group",
    group: "A",
    homeTeam: { code: "MEX", name: "Mexico" },
    awayTeam: { code: "RSA", name: "South Africa" },
    localDate: kickoffAtUtc.slice(0, 10),
    kickoffTimeLocal: "13:00",
    kickoffAtUtc,
    venue: "Test Stadium",
    sourceId: "test-source",
    externalIds: footballDataId ? { footballData: footballDataId } : {}
  };
}

function result(matchId: string): StoredResult {
  return {
    matchId,
    homeScore: 1,
    awayScore: 0,
    recordedAt: "2026-06-11T22:00:00.000Z",
    resultSource: "manual",
    externalMatchId: null,
    fetchedAt: null
  };
}
