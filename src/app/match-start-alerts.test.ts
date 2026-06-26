import { describe, expect, test, vi } from "vitest";

import { runMatchStartAlertTick, type MatchStartAlertMessage } from "./match-start-alerts.js";
import type { StoredMatchStartAlert, StoredResult } from "../storage/database.js";
import type { WorldCupMatch } from "../worldcup/types.js";

describe("runMatchStartAlertTick", () => {
  test("posts one role ping for matches that start at the same time", async () => {
    const sentMessages: MatchStartAlertMessage[] = [];
    const storedAlerts: StoredMatchStartAlert[] = [];

    const result = await runMatchStartAlertTick({
      channelId: "channel-1",
      roleId: "role-canalhas",
      matches: [
        match("wc2026-001", 1, "MEX", "México", "RSA", "África do Sul", "2026-06-11T19:00:00.000Z"),
        match("wc2026-002", 2, "CAN", "Canadá", "QAT", "Catar", "2026-06-11T19:00:00.000Z")
      ],
      results: [],
      alerts: [],
      now: () => new Date("2026-06-11T18:55:20.000Z"),
      sendAlert: async (message) => {
        sentMessages.push(message);
        return "match-start-message-1";
      },
      deleteAlert: vi.fn(),
      recordAlert: (alert) => storedAlerts.push(alert),
      markAlertDeleted: vi.fn()
    });

    expect(result).toEqual({
      posted: ["wc2026-001", "wc2026-002"],
      deleted: [],
      skipped: []
    });
    expect(sentMessages).toEqual([
      {
        content: [
          "<@&role-canalhas>",
          "PARTIDAS COMEÇANDO",
          "México x África do Sul",
          "Canadá x Catar",
          "",
          "CazeTV: https://www.youtube.com/@CazeTV"
        ].join("\n"),
        allowedMentions: { parse: [], roles: ["role-canalhas"] }
      }
    ]);
    expect(storedAlerts).toEqual([
      {
        matchId: "wc2026-001",
        channelId: "channel-1",
        messageId: "match-start-message-1",
        postedAt: "2026-06-11T18:55:20.000Z",
        deleteAfterUtc: "2026-06-11T22:00:00.000Z",
        deletedAt: null
      },
      {
        matchId: "wc2026-002",
        channelId: "channel-1",
        messageId: "match-start-message-1",
        postedAt: "2026-06-11T18:55:20.000Z",
        deleteAfterUtc: "2026-06-11T22:00:00.000Z",
        deletedAt: null
      }
    ]);
  });

  test("does not post before the start alert lead window", async () => {
    const sendAlert = vi.fn(async () => "match-start-message-1");

    const result = await runMatchStartAlertTick({
      channelId: "channel-1",
      roleId: "role-canalhas",
      matches: [
        match("wc2026-001", 1, "MEX", "México", "RSA", "África do Sul", "2026-06-11T19:00:00.000Z")
      ],
      results: [],
      alerts: [],
      now: () => new Date("2026-06-11T18:54:59.000Z"),
      sendAlert,
      deleteAlert: vi.fn(),
      recordAlert: vi.fn(),
      markAlertDeleted: vi.fn()
    });

    expect(result.posted).toEqual([]);
    expect(sendAlert).not.toHaveBeenCalled();
  });

  test("uses a configured start alert lead window", async () => {
    const sendAlert = vi.fn(async () => "match-start-message-1");

    const result = await runMatchStartAlertTick({
      channelId: "channel-1",
      roleId: "role-canalhas",
      matches: [
        match("wc2026-001", 1, "MEX", "México", "RSA", "África do Sul", "2026-06-11T19:00:00.000Z")
      ],
      results: [],
      alerts: [],
      startLeadMinutes: 2,
      now: () => new Date("2026-06-11T18:58:00.000Z"),
      sendAlert,
      deleteAlert: vi.fn(),
      recordAlert: vi.fn(),
      markAlertDeleted: vi.fn()
    });

    expect(result.posted).toEqual(["wc2026-001"]);
    expect(sendAlert).toHaveBeenCalledOnce();
  });

  test("does not post start alerts for unresolved knockout placeholder matches", async () => {
    const sendAlert = vi.fn(async () => "match-start-message-1");

    const result = await runMatchStartAlertTick({
      channelId: "channel-1",
      roleId: "role-canalhas",
      matches: [
        knockoutMatch(
          "wc2026-073",
          73,
          "2A",
          "2º Grupo A",
          "2B",
          "2º Grupo B",
          "2026-06-28T19:00:00.000Z"
        )
      ],
      results: [],
      alerts: [],
      now: () => new Date("2026-06-28T18:55:00.000Z"),
      sendAlert,
      deleteAlert: vi.fn(),
      recordAlert: vi.fn(),
      markAlertDeleted: vi.fn()
    });

    expect(result.posted).toEqual([]);
    expect(sendAlert).not.toHaveBeenCalled();
  });

  test("does not repost a match that already has a start alert", async () => {
    const sendAlert = vi.fn(async () => "match-start-message-2");

    const result = await runMatchStartAlertTick({
      channelId: "channel-1",
      roleId: "role-canalhas",
      matches: [
        match("wc2026-001", 1, "MEX", "México", "RSA", "África do Sul", "2026-06-11T19:00:00.000Z")
      ],
      results: [],
      alerts: [
        alert("wc2026-001", "channel-1", "match-start-message-1", "2026-06-11T22:00:00.000Z")
      ],
      now: () => new Date("2026-06-11T19:01:00.000Z"),
      sendAlert,
      deleteAlert: vi.fn(),
      recordAlert: vi.fn(),
      markAlertDeleted: vi.fn()
    });

    expect(result.posted).toEqual([]);
    expect(sendAlert).not.toHaveBeenCalled();
  });

  test("deletes a grouped alert only after all matches have final results", async () => {
    const deleteAlert = vi.fn(async () => undefined);
    const deleted: Array<{ matchIds: readonly string[]; deletedAt: string }> = [];

    const result = await runMatchStartAlertTick({
      channelId: "channel-1",
      roleId: "role-canalhas",
      matches: [
        match("wc2026-001", 1, "MEX", "México", "RSA", "África do Sul", "2026-06-11T19:00:00.000Z"),
        match("wc2026-002", 2, "CAN", "Canadá", "QAT", "Catar", "2026-06-11T19:00:00.000Z")
      ],
      results: [resultFor("wc2026-001"), resultFor("wc2026-002")],
      alerts: [
        alert("wc2026-001", "channel-1", "match-start-message-1", "2026-06-11T22:00:00.000Z"),
        alert("wc2026-002", "channel-1", "match-start-message-1", "2026-06-11T22:00:00.000Z")
      ],
      now: () => new Date("2026-06-11T21:05:00.000Z"),
      sendAlert: vi.fn(),
      deleteAlert,
      recordAlert: vi.fn(),
      markAlertDeleted: (matchIds, deletedAt) => deleted.push({ matchIds, deletedAt })
    });

    expect(result.deleted).toEqual(["match-start-message-1"]);
    expect(deleteAlert).toHaveBeenCalledWith("match-start-message-1");
    expect(deleted).toEqual([
      {
        matchIds: ["wc2026-001", "wc2026-002"],
        deletedAt: "2026-06-11T21:05:00.000Z"
      }
    ]);
  });

  test("deletes a stale alert after the fallback deadline even without final results", async () => {
    const deleteAlert = vi.fn(async () => undefined);

    const result = await runMatchStartAlertTick({
      channelId: "channel-1",
      roleId: "role-canalhas",
      matches: [
        match("wc2026-001", 1, "MEX", "México", "RSA", "África do Sul", "2026-06-11T19:00:00.000Z")
      ],
      results: [],
      alerts: [
        alert("wc2026-001", "channel-1", "match-start-message-1", "2026-06-11T22:00:00.000Z")
      ],
      now: () => new Date("2026-06-11T22:00:01.000Z"),
      sendAlert: vi.fn(),
      deleteAlert,
      recordAlert: vi.fn(),
      markAlertDeleted: vi.fn()
    });

    expect(result.deleted).toEqual(["match-start-message-1"]);
    expect(deleteAlert).toHaveBeenCalledWith("match-start-message-1");
  });
});

function match(
  id: string,
  matchNumber: number,
  homeCode: string,
  homeName: string,
  awayCode: string,
  awayName: string,
  kickoffAtUtc: string
): WorldCupMatch {
  return {
    id,
    matchNumber,
    phase: "group",
    group: "A",
    homeTeam: { code: homeCode, name: homeName },
    awayTeam: { code: awayCode, name: awayName },
    localDate: kickoffAtUtc.slice(0, 10),
    kickoffTimeLocal: "16:00",
    kickoffAtUtc,
    venue: "Test Stadium",
    sourceId: "test-source",
    externalIds: {}
  };
}

function knockoutMatch(
  id: string,
  matchNumber: number,
  homeCode: string,
  homeName: string,
  awayCode: string,
  awayName: string,
  kickoffAtUtc: string
): WorldCupMatch {
  return {
    id,
    matchNumber,
    phase: "round_of_32",
    group: null,
    homeTeam: { code: homeCode, name: homeName },
    awayTeam: { code: awayCode, name: awayName },
    localDate: kickoffAtUtc.slice(0, 10),
    kickoffTimeLocal: "16:00",
    kickoffAtUtc,
    venue: "Test Stadium",
    sourceId: "test-source",
    externalIds: {}
  };
}

function alert(
  matchId: string,
  channelId: string,
  messageId: string,
  deleteAfterUtc: string
): StoredMatchStartAlert {
  return {
    matchId,
    channelId,
    messageId,
    postedAt: "2026-06-11T19:00:20.000Z",
    deleteAfterUtc,
    deletedAt: null
  };
}

function resultFor(matchId: string): StoredResult {
  return {
    matchId,
    homeScore: 1,
    awayScore: 0,
    recordedAt: "2026-06-11T21:00:00.000Z",
    resultSource: "manual",
    externalMatchId: null,
    fetchedAt: null
  };
}
