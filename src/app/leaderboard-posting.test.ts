import { describe, expect, test, vi } from "vitest";

import { updateLeaderboardDashboard } from "./leaderboard-posting.js";
import type { StoredLeaderboardPost, StoredPrediction, StoredResult } from "../storage/database.js";

describe("updateLeaderboardDashboard", () => {
  test("posts and records the leaderboard dashboard when none exists", async () => {
    const records: StoredLeaderboardPost[] = [];
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
      upsertLeaderboardMessage
    });

    expect(result).toEqual({
      action: "updated",
      post: {
        messageId: "leaderboard-message-1",
        action: "posted"
      }
    });
    expect(upsertLeaderboardMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining("Ranking Copanalhas")
      }),
      null
    );
    expect(upsertLeaderboardMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining("Como funciona")
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
      upsertLeaderboardMessage
    });

    expect(result.post).toEqual({
      messageId: "replacement-message",
      action: "replaced"
    });
    expect(records[0]?.messageId).toBe("replacement-message");
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
