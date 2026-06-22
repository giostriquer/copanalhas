import { Buffer } from "node:buffer";

import { describe, expect, test, vi } from "vitest";

import { updateChaosRecaps } from "./chaos-dashboard-posting.js";
import type { ChaosDashboardMessage } from "../chaos-dashboard/format.js";
import type { ChaosRecapCopyInput } from "../chaos-dashboard/recap-copy.js";
import type {
  StoredChaosDashboardPost,
  StoredChaosWeeklySnapshotRow,
  StoredPrediction,
  StoredResult
} from "../storage/database.js";
import { WORLD_CUP_2026_SEED } from "../worldcup/seed.js";

describe("updateChaosRecaps", () => {
  test("posts and records only completed recap periods", async () => {
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

    const result = await updateChaosRecaps({
      ...baseOptionsWithCompletedGroupWeekOne(),
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
      posted: [
        {
          periodKey: "group-week-1",
          messageId: "chaos-message-1",
          action: "posted",
          renderState: "image"
        }
      ],
      skipped: [
        { periodKey: "group-week-2", reason: "incomplete" },
        { periodKey: "group-week-3", reason: "incomplete" }
      ]
    });
    expect(posts).toEqual([
      {
        periodKey: "group-week-1",
        guildId: "guild-1",
        channelId: "channel-1",
        messageId: "chaos-message-1",
        createdAt: "2026-06-24T15:30:00.000Z",
        updatedAt: "2026-06-24T15:30:00.000Z"
      }
    ]);
    expect(snapshots.length).toBeGreaterThan(0);
  });

  test("edits an existing recap period and preserves created time", async () => {
    const posts: StoredChaosDashboardPost[] = [existingPost("group-week-1")];
    const upsertChaosDashboardMessage = vi.fn(async (_message, existingMessageId) => {
      expect(existingMessageId).toBe("chaos-message-1");
      return "chaos-message-1";
    });

    const result = await updateChaosRecaps({
      ...baseOptionsWithCompletedGroupWeekOne(new Date("2026-06-24T15:35:00.000Z")),
      listChaosDashboardPosts: () => posts,
      recordChaosDashboardPost: (post) => {
        posts.splice(0, posts.length, post);
      },
      listChaosWeeklySnapshotRows: () => existingSnapshotRows(),
      recordChaosWeeklySnapshotRows: vi.fn(),
      renderPng: vi.fn(async () => Buffer.from("png")),
      upsertChaosDashboardMessage
    });

    expect(result.posted[0]).toMatchObject({
      periodKey: "group-week-1",
      messageId: "chaos-message-1",
      action: "edited"
    });
    expect(posts[0]).toEqual({
      periodKey: "group-week-1",
      guildId: "guild-1",
      channelId: "channel-1",
      messageId: "chaos-message-1",
      createdAt: "2026-06-24T15:00:00.000Z",
      updatedAt: "2026-06-24T15:35:00.000Z"
    });
  });

  test("records a replacement when the adapter returns a new message id", async () => {
    const posts: StoredChaosDashboardPost[] = [existingPost("group-week-1")];

    const result = await updateChaosRecaps({
      ...baseOptionsWithCompletedGroupWeekOne(),
      listChaosDashboardPosts: () => posts,
      recordChaosDashboardPost: (post) => {
        posts.splice(0, posts.length, post);
      },
      listChaosWeeklySnapshotRows: () => existingSnapshotRows(),
      recordChaosWeeklySnapshotRows: vi.fn(),
      renderPng: vi.fn(async () => Buffer.from("png")),
      upsertChaosDashboardMessage: vi.fn(async () => "replacement-message")
    });

    expect(result.posted[0]).toMatchObject({
      periodKey: "group-week-1",
      messageId: "replacement-message",
      action: "replaced"
    });
    expect(posts[0]?.messageId).toBe("replacement-message");
  });

  test("posts a text fallback when image rendering throws", async () => {
    const postedMessages: ChaosDashboardMessage[] = [];

    const result = await updateChaosRecaps({
      ...baseOptionsWithCompletedGroupWeekOne(),
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

    expect(result.posted[0]).toMatchObject({
      periodKey: "group-week-1",
      renderState: "text-fallback",
      renderError: "sharp failed"
    });
    expect(postedMessages[0]?.files).toEqual([]);
    expect(postedMessages[0]?.content).toContain("Imagem indisponivel no momento");
  });

  test("resolves display names for leaderboard users", async () => {
    const resolveUserDisplayNames = vi.fn(async (userIds: readonly string[]) => {
      expect(userIds).toContain("user-a");
      return new Map([["user-a", "Guibexa"]]);
    });
    let postedContent = "";

    await updateChaosRecaps({
      ...baseOptionsWithCompletedGroupWeekOne(),
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

  test("resolves avatars for weekly profile cards", async () => {
    const groupWeekOneMatches = WORLD_CUP_2026_SEED.matches.filter(
      (match) => match.matchNumber <= 24
    );
    const firstFiveMatches = groupWeekOneMatches.slice(0, 5);
    const firstMatch = firstFiveMatches[0]!;
    const resolveUserAvatarDataUris = vi.fn(async (userIds: readonly string[]) => {
      expect(userIds).toEqual(["user-a", "user-b"]);
      return new Map([
        ["user-a", "data:image/png;base64,leader-avatar"],
        ["user-b", "data:image/png;base64,apostazu-avatar"]
      ]);
    });
    let renderedSvg = "";

    await updateChaosRecaps({
      ...baseOptionsWithCompletedGroupWeekOne(),
      predictions: firstFiveMatches.flatMap((match) => {
        const exactScore = match.id === firstMatch.id ? [2, 1] : [1, 0];

        return [
          prediction("user-a", match.id, exactScore[0]!, exactScore[1]!),
          prediction("user-b", match.id, 0, 3)
        ];
      }),
      listChaosDashboardPosts: () => [],
      recordChaosDashboardPost: vi.fn(),
      listChaosWeeklySnapshotRows: () => existingSnapshotRows(),
      recordChaosWeeklySnapshotRows: vi.fn(),
      resolveUserAvatarDataUris,
      renderPng: vi.fn(async (svg) => {
        renderedSvg = svg;
        return Buffer.from("png");
      }),
      upsertChaosDashboardMessage: vi.fn(async () => "chaos-message-1")
    });

    expect(resolveUserAvatarDataUris).toHaveBeenCalledOnce();
    expect(renderedSvg).toContain("Lider da Semana");
    expect(renderedSvg).toContain("Apostazu da Semana");
    expect(renderedSvg).toContain('href="data:image/png;base64,leader-avatar"');
    expect(renderedSvg).toContain('href="data:image/png;base64,apostazu-avatar"');
  });

  test("applies generated recap copy before rendering the image", async () => {
    let renderedSvg = "";
    const generateChaosRecapCopy = vi.fn(async (input: ChaosRecapCopyInput) => {
      expect(input.periodKey).toBe("group-week-1");
      expect(input.awards.length).toBeGreaterThan(0);

      return {
        version: 1 as const,
        periodKey: input.periodKey,
        cards: [
          {
            key: input.awards[0]!.key,
            title: "Oraculo do Zap",
            subtitle: "Transformou dado bom em zoeira auditavel."
          }
        ]
      };
    });

    const result = await updateChaosRecaps({
      ...baseOptionsWithCompletedGroupWeekOne(),
      listChaosDashboardPosts: () => [],
      recordChaosDashboardPost: vi.fn(),
      listChaosWeeklySnapshotRows: () => existingSnapshotRows(),
      recordChaosWeeklySnapshotRows: vi.fn(),
      generateChaosRecapCopy,
      renderPng: vi.fn(async (svg) => {
        renderedSvg = svg;
        return Buffer.from("png");
      }),
      upsertChaosDashboardMessage: vi.fn(async () => "chaos-message-1")
    });

    expect(generateChaosRecapCopy).toHaveBeenCalledOnce();
    expect(renderedSvg).toContain("Oraculo do Zap");
    expect(renderedSvg).toContain("Transformou dado bom em");
    expect(renderedSvg).toContain("zoeira auditavel.");
    expect(result.posted[0]).toMatchObject({
      periodKey: "group-week-1",
      copyState: "applied"
    });
  });

  test("falls back to deterministic recap copy when generation fails", async () => {
    let renderedSvg = "";

    const result = await updateChaosRecaps({
      ...baseOptionsWithCompletedGroupWeekOne(),
      listChaosDashboardPosts: () => [],
      recordChaosDashboardPost: vi.fn(),
      listChaosWeeklySnapshotRows: () => existingSnapshotRows(),
      recordChaosWeeklySnapshotRows: vi.fn(),
      generateChaosRecapCopy: vi.fn(async () => {
        throw new Error("codex unavailable");
      }),
      renderPng: vi.fn(async (svg) => {
        renderedSvg = svg;
        return Buffer.from("png");
      }),
      upsertChaosDashboardMessage: vi.fn(async () => "chaos-message-1")
    });

    expect(renderedSvg).toContain("Profeta isolado");
    expect(result.posted[0]).toMatchObject({
      periodKey: "group-week-1",
      copyState: "fallback",
      copyError: "codex unavailable"
    });
  });
});

function baseOptionsWithCompletedGroupWeekOne(now = new Date("2026-06-24T15:30:00.000Z")) {
  const firstMatch = WORLD_CUP_2026_SEED.matches[0]!;

  return {
    guildId: "guild-1",
    channelId: "channel-1",
    matches: WORLD_CUP_2026_SEED.matches,
    predictions: [
      prediction("user-a", firstMatch.id, 2, 1),
      prediction("user-b", firstMatch.id, 1, 0)
    ],
    results: WORLD_CUP_2026_SEED.matches
      .filter((match) => match.matchNumber <= 24)
      .map((match) =>
        match.id === firstMatch.id ? resultFor(match.id, 2, 1) : resultFor(match.id, 1, 0)
      ),
    timeZone: "UTC",
    now: () => now
  };
}

function existingPost(periodKey: string): StoredChaosDashboardPost {
  return {
    periodKey,
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
