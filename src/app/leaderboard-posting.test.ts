import { Buffer } from "node:buffer";

import { describe, expect, test, vi } from "vitest";

import { updateLeaderboardDashboard } from "./leaderboard-posting.js";
import type { LeaderboardDashboardMessage } from "../leaderboard/format.js";
import type { StoredLeaderboardPost, StoredPrediction, StoredResult } from "../storage/database.js";

describe("updateLeaderboardDashboard", () => {
  test("posts and records the leaderboard dashboard when none exists", async () => {
    const records: StoredLeaderboardPost[] = [];
    const png = Buffer.from("png");
    const renderPng = vi.fn(async (svg: string) => {
      expect(svg).toContain("<svg");
      expect(svg).toContain("Ranking Copanalhas");
      return png;
    });
    const upsertLeaderboardMessage = vi.fn(async (_message, existingMessageId) => {
      expect(existingMessageId).toBeNull();
      return "leaderboard-message-1";
    });

    const result = await updateLeaderboardDashboard({
      guildId: "guild-1",
      channelId: "channel-1",
      predictions: [prediction("user-1", "wc2026-001", 2, 1)],
      results: [resultFor("wc2026-001", 2, 1)],
      timeZone: "UTC",
      now: () => new Date("2026-06-11T23:30:00.000Z"),
      listLeaderboardPosts: () => records,
      recordLeaderboardPost: (post) => records.push(post),
      renderPng,
      upsertLeaderboardMessage
    });

    expect(result).toEqual({
      action: "updated",
      post: {
        messageId: "leaderboard-message-1",
        action: "posted"
      },
      renderState: "image"
    });
    expect(upsertLeaderboardMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining("**Ranking Copanalhas**"),
        files: [{ attachment: png, name: "copanalhas-leaderboard.png" }]
      }),
      null
    );
    expect(upsertLeaderboardMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining("Imagem atualizada.")
      }),
      null
    );
    expect(records).toEqual([
      {
        guildId: "guild-1",
        channelId: "channel-1",
        messageId: "leaderboard-message-1",
        createdAt: "2026-06-11T23:30:00.000Z",
        updatedAt: "2026-06-11T23:30:00.000Z"
      }
    ]);
  });

  test("edits an existing leaderboard dashboard and preserves created time", async () => {
    const records: StoredLeaderboardPost[] = [existingPost()];
    const upsertLeaderboardMessage = vi.fn(async (_message, existingMessageId) => {
      expect(existingMessageId).toBe("leaderboard-message-1");
      return "leaderboard-message-1";
    });

    const result = await updateLeaderboardDashboard({
      guildId: "guild-1",
      channelId: "channel-1",
      predictions: [],
      results: [],
      timeZone: "UTC",
      now: () => new Date("2026-06-11T23:35:00.000Z"),
      listLeaderboardPosts: () => records,
      recordLeaderboardPost: (post) => {
        records.splice(0, records.length, post);
      },
      renderPng: vi.fn(async () => Buffer.from("png")),
      upsertLeaderboardMessage
    });

    expect(result.post).toEqual({
      messageId: "leaderboard-message-1",
      action: "edited"
    });
    expect(records[0]).toEqual({
      guildId: "guild-1",
      channelId: "channel-1",
      messageId: "leaderboard-message-1",
      createdAt: "2026-06-11T23:00:00.000Z",
      updatedAt: "2026-06-11T23:35:00.000Z"
    });
  });

  test("shows prediction participants before any match has a result", async () => {
    let renderedSvg = "";
    const renderPng = vi.fn(async (svg: string) => {
      renderedSvg = svg;
      return Buffer.from("png");
    });
    const upsertLeaderboardMessage = vi.fn(
      async (_message: LeaderboardDashboardMessage) => {
        return "leaderboard-message-1";
      }
    );

    await updateLeaderboardDashboard({
      guildId: "guild-1",
      channelId: "channel-1",
      predictions: [
        prediction("user-2", "wc2026-001", 1, 1),
        prediction("user-1", "wc2026-002", 2, 0)
      ],
      results: [],
      timeZone: "UTC",
      now: () => new Date("2026-06-11T23:35:00.000Z"),
      listLeaderboardPosts: () => [],
      recordLeaderboardPost: vi.fn(),
      renderPng,
      upsertLeaderboardMessage
    });

    expect(renderedSvg).toContain("user-1");
    expect(renderedSvg).toContain("user-2");
  });

  test("renders resolved Discord display names instead of raw user ids", async () => {
    let renderedSvg = "";
    const renderPng = vi.fn(async (svg: string) => {
      renderedSvg = svg;
      return Buffer.from("png");
    });
    const resolveUserDisplayNames = vi.fn(async (userIds: readonly string[]) => {
      expect(userIds).toEqual(["user-1", "user-2"]);

      return new Map([
        ["user-1", "Giova"],
        ["user-2", "Ana"]
      ]);
    });
    const upsertLeaderboardMessage = vi.fn(
      async (_message: LeaderboardDashboardMessage) => {
        return "leaderboard-message-1";
      }
    );

    await updateLeaderboardDashboard({
      guildId: "guild-1",
      channelId: "channel-1",
      predictions: [
        prediction("user-2", "wc2026-001", 1, 1),
        prediction("user-1", "wc2026-002", 2, 0)
      ],
      results: [],
      timeZone: "UTC",
      now: () => new Date("2026-06-11T23:35:00.000Z"),
      listLeaderboardPosts: () => [],
      recordLeaderboardPost: vi.fn(),
      resolveUserDisplayNames,
      renderPng,
      upsertLeaderboardMessage
    });

    expect(resolveUserDisplayNames).toHaveBeenCalledOnce();
    expect(renderedSvg).toContain("Giova");
    expect(renderedSvg).toContain("Ana");
    expect(renderedSvg).not.toContain("user-1");
    expect(renderedSvg).not.toContain("user-2");
  });

  test("records a replacement when the adapter returns a new message id", async () => {
    const records: StoredLeaderboardPost[] = [existingPost()];
    const upsertLeaderboardMessage = vi.fn(async () => "replacement-message");

    const result = await updateLeaderboardDashboard({
      guildId: "guild-1",
      channelId: "channel-1",
      predictions: [],
      results: [],
      timeZone: "UTC",
      now: () => new Date("2026-06-11T23:40:00.000Z"),
      listLeaderboardPosts: () => records,
      recordLeaderboardPost: (post) => {
        records.splice(0, records.length, post);
      },
      renderPng: vi.fn(async () => Buffer.from("png")),
      upsertLeaderboardMessage
    });

    expect(result.post).toEqual({
      messageId: "replacement-message",
      action: "replaced"
    });
    expect(records[0]?.messageId).toBe("replacement-message");
  });

  test("records a text-only fallback when rendering throws", async () => {
    const postedMessages: LeaderboardDashboardMessage[] = [];

    const result = await updateLeaderboardDashboard({
      guildId: "guild-1",
      channelId: "channel-1",
      predictions: [prediction("user-1", "wc2026-001", 2, 1)],
      results: [resultFor("wc2026-001", 2, 1)],
      timeZone: "UTC",
      now: () => new Date("2026-06-11T23:45:00.000Z"),
      listLeaderboardPosts: () => [],
      recordLeaderboardPost: vi.fn(),
      renderPng: vi.fn(async () => {
        throw new Error("sharp failed");
      }),
      upsertLeaderboardMessage: vi.fn(async (message) => {
        postedMessages.push(message);
        return "leaderboard-message-1";
      })
    });

    expect(result.renderState).toBe("text-fallback");
    expect(result.renderError).toBe("sharp failed");
    expect(postedMessages[0]?.files).toEqual([]);
    expect(postedMessages[0]?.content).toContain("Dashboard image render failed: sharp failed");
    expect(postedMessages[0]?.content).toContain("1    5    1     0     0     0     1  user-1");
  });
});

function existingPost(): StoredLeaderboardPost {
  return {
    guildId: "guild-1",
    channelId: "channel-1",
    messageId: "leaderboard-message-1",
    createdAt: "2026-06-11T23:00:00.000Z",
    updatedAt: "2026-06-11T23:00:00.000Z"
  };
}

function prediction(
  userId: string,
  matchId: string,
  homeScore: number,
  awayScore: number
): StoredPrediction {
  return {
    userId,
    matchId,
    messageId: `message-${userId}`,
    homeScore,
    awayScore,
    submittedAt: "2026-06-11T12:00:00.000Z",
    updatedAt: null,
    parserVersion: "prediction-modal-v1"
  };
}

function resultFor(matchId: string, homeScore: number, awayScore: number): StoredResult {
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
