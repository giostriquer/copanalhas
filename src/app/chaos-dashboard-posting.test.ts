import { Buffer } from "node:buffer";

import { describe, expect, test, vi } from "vitest";

import { updateChaosDashboard } from "./chaos-dashboard-posting.js";
import type { ChaosDashboardMessage } from "../chaos-dashboard/format.js";
import type {
  StoredChaosDashboardPost,
  StoredChaosWeeklySnapshotRow,
  StoredPrediction,
  StoredResult
} from "../storage/database.js";
import { WORLD_CUP_2026_SEED } from "../worldcup/seed.js";

describe("updateChaosDashboard", () => {
  test("posts and records the chaos dashboard when none exists", async () => {
    const posts: StoredChaosDashboardPost[] = [];
    const snapshots: StoredChaosWeeklySnapshotRow[] = [];
    const png = Buffer.from("png");
    const renderPng = vi.fn(async (svg: string) => {
      expect(svg).toContain("<svg");
      return png;
    });
    const upsertChaosDashboardMessage = vi.fn(async (message, existingMessageId) => {
      expect(existingMessageId).toBeNull();
      expect(message.content).toContain("Copanalhas Recap");
      expect(message.files[0]?.attachment).toBe(png);
      return "chaos-message-1";
    });

    const result = await updateChaosDashboard({
      ...baseOptions(),
      listChaosDashboardPosts: () => posts,
      recordChaosDashboardPost: (post) => posts.push(post),
      listChaosWeeklySnapshotRows: () => snapshots,
      recordChaosWeeklySnapshotRows: (_weekStart, _guildId, _channelId, rows, createdAt) => {
        snapshots.push(
          ...rows.map((row) => ({
            ...row,
            weekStart: "2026-06-22",
            guildId: "guild-1",
            channelId: "channel-1",
            createdAt
          }))
        );
      },
      renderPng,
      upsertChaosDashboardMessage
    });

    expect(result).toEqual({
      action: "updated",
      post: {
        messageId: "chaos-message-1",
        action: "posted"
      },
      weekStart: "2026-06-22",
      renderState: "image"
    });
    expect(posts).toEqual([
      {
        guildId: "guild-1",
        channelId: "channel-1",
        messageId: "chaos-message-1",
        createdAt: "2026-06-24T15:30:00.000Z",
        updatedAt: "2026-06-24T15:30:00.000Z"
      }
    ]);
    expect(snapshots.length).toBeGreaterThan(0);
  });

  test("edits an existing chaos dashboard and preserves created time", async () => {
    const posts: StoredChaosDashboardPost[] = [existingPost()];
    const upsertChaosDashboardMessage = vi.fn(async (_message, existingMessageId) => {
      expect(existingMessageId).toBe("chaos-message-1");
      return "chaos-message-1";
    });

    const result = await updateChaosDashboard({
      ...baseOptions(new Date("2026-06-24T15:35:00.000Z")),
      listChaosDashboardPosts: () => posts,
      recordChaosDashboardPost: (post) => {
        posts.splice(0, posts.length, post);
      },
      listChaosWeeklySnapshotRows: () => existingSnapshotRows(),
      recordChaosWeeklySnapshotRows: vi.fn(),
      renderPng: vi.fn(async () => Buffer.from("png")),
      upsertChaosDashboardMessage
    });

    expect(result.post).toEqual({
      messageId: "chaos-message-1",
      action: "edited"
    });
    expect(posts[0]).toEqual({
      guildId: "guild-1",
      channelId: "channel-1",
      messageId: "chaos-message-1",
      createdAt: "2026-06-24T15:00:00.000Z",
      updatedAt: "2026-06-24T15:35:00.000Z"
    });
  });

  test("records a replacement when the adapter returns a new message id", async () => {
    const posts: StoredChaosDashboardPost[] = [existingPost()];

    const result = await updateChaosDashboard({
      ...baseOptions(),
      listChaosDashboardPosts: () => posts,
      recordChaosDashboardPost: (post) => {
        posts.splice(0, posts.length, post);
      },
      listChaosWeeklySnapshotRows: () => existingSnapshotRows(),
      recordChaosWeeklySnapshotRows: vi.fn(),
      renderPng: vi.fn(async () => Buffer.from("png")),
      upsertChaosDashboardMessage: vi.fn(async () => "replacement-message")
    });

    expect(result.post).toEqual({
      messageId: "replacement-message",
      action: "replaced"
    });
    expect(posts[0]?.messageId).toBe("replacement-message");
  });

  test("posts a text fallback when image rendering throws", async () => {
    const postedMessages: ChaosDashboardMessage[] = [];

    const result = await updateChaosDashboard({
      ...baseOptions(),
      listChaosDashboardPosts: () => [],
      recordChaosDashboardPost: vi.fn(),
      listChaosWeeklySnapshotRows: () => existingSnapshotRows(),
      recordChaosWeeklySnapshotRows: vi.fn(),
      renderPng: vi.fn(async () => {
        throw new Error("sharp failed");
      }),
      upsertChaosDashboardMessage: vi.fn(async (message) => {
        postedMessages.push(message);
        return "chaos-message-1";
      })
    });

    expect(result.renderState).toBe("text-fallback");
    expect(result.renderError).toBe("sharp failed");
    expect(postedMessages[0]?.files).toEqual([]);
    expect(postedMessages[0]?.content).toContain("Imagem indisponivel no momento");
  });

  test("resolves display names for leaderboard users", async () => {
    const resolveUserDisplayNames = vi.fn(async (userIds: readonly string[]) => {
      expect(userIds).toContain("user-a");
      return new Map([["user-a", "Guibexa"]]);
    });
    let postedContent = "";

    await updateChaosDashboard({
      ...baseOptions(),
      listChaosDashboardPosts: () => [],
      recordChaosDashboardPost: vi.fn(),
      listChaosWeeklySnapshotRows: () => existingSnapshotRows(),
      recordChaosWeeklySnapshotRows: vi.fn(),
      resolveUserDisplayNames,
      renderPng: vi.fn(async () => Buffer.from("png")),
      upsertChaosDashboardMessage: vi.fn(async (message) => {
        postedContent = message.content;
        return "chaos-message-1";
      })
    });

    expect(resolveUserDisplayNames).toHaveBeenCalledOnce();
    expect(postedContent).toContain("Copanalhas Recap");
  });
});

function baseOptions(now = new Date("2026-06-24T15:30:00.000Z")) {
  const firstMatch = WORLD_CUP_2026_SEED.matches[0]!;

  return {
    guildId: "guild-1",
    channelId: "channel-1",
    matches: WORLD_CUP_2026_SEED.matches,
    predictions: [
      prediction("user-a", firstMatch.id, 2, 1),
      prediction("user-b", firstMatch.id, 1, 0)
    ],
    results: [resultFor(firstMatch.id, 2, 1)],
    timeZone: "UTC",
    now: () => now
  };
}

function existingPost(): StoredChaosDashboardPost {
  return {
    guildId: "guild-1",
    channelId: "channel-1",
    messageId: "chaos-message-1",
    createdAt: "2026-06-24T15:00:00.000Z",
    updatedAt: "2026-06-24T15:00:00.000Z"
  };
}

function existingSnapshotRows(): StoredChaosWeeklySnapshotRow[] {
  return [
    {
      weekStart: "2026-06-22",
      guildId: "guild-1",
      channelId: "channel-1",
      userId: "user-a",
      rank: 2,
      points: 0,
      soloCount: 0,
      exactCount: 0,
      outcomeCount: 0,
      closestCount: 0,
      createdAt: "2026-06-22T00:00:00.000Z"
    }
  ];
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
    submittedAt: "2026-06-24T12:00:00.000Z",
    updatedAt: null,
    parserVersion: "prediction-modal-v1"
  };
}

function resultFor(matchId: string, homeScore: number, awayScore: number): StoredResult {
  return {
    matchId,
    homeScore,
    awayScore,
    recordedAt: "2026-06-24T15:00:00.000Z",
    resultSource: "manual",
    externalMatchId: null,
    fetchedAt: null
  };
}
