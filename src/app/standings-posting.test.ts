import { describe, expect, test, vi } from "vitest";
import { Buffer } from "node:buffer";

import { updateStandingsDashboard } from "./standings-posting.js";
import type { StoredStandingsPost } from "../storage/database.js";
import { WORLD_CUP_2026_SEED } from "../worldcup/seed.js";

describe("updateStandingsDashboard", () => {
  test("posts and records both standings dashboard messages when none exist", async () => {
    const records: StoredStandingsPost[] = [];
    const renderPng = vi.fn(async (svg: string) => {
      expect(svg).toContain("<svg");
      return Buffer.from(`png-${renderPng.mock.calls.length + 1}`);
    });
    const upsertStandingsMessage = vi.fn(async (message, existingMessageId) => {
      expect(existingMessageId).toBeNull();
      expect(message.files).toHaveLength(1);
      return `message-${message.key}`;
    });

    const result = await updateStandingsDashboard({
      guildId: "guild-1",
      channelId: "channel-1",
      matches: WORLD_CUP_2026_SEED.matches,
      results: [],
      timeZone: "UTC",
      now: () => new Date("2026-06-11T12:00:00.000Z"),
      listStandingsPosts: () => records,
      recordStandingsPost: (post) => records.push(post),
      renderPng,
      upsertStandingsMessage
    });

    expect(renderPng).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      action: "updated",
      posts: [
        {
          postKey: "groups_a_f",
          messageId: "message-groups_a_f",
          action: "posted",
          renderState: "image"
        },
        {
          postKey: "groups_g_l",
          messageId: "message-groups_g_l",
          action: "posted",
          renderState: "image"
        }
      ]
    });
    expect(records).toEqual([
      {
        postKey: "groups_a_f",
        guildId: "guild-1",
        channelId: "channel-1",
        messageId: "message-groups_a_f",
        createdAt: "2026-06-11T12:00:00.000Z",
        updatedAt: "2026-06-11T12:00:00.000Z"
      },
      {
        postKey: "groups_g_l",
        guildId: "guild-1",
        channelId: "channel-1",
        messageId: "message-groups_g_l",
        createdAt: "2026-06-11T12:00:00.000Z",
        updatedAt: "2026-06-11T12:00:00.000Z"
      }
    ]);
  });

  test("falls back to text when standings image rendering throws", async () => {
    const postedMessages: string[] = [];

    const result = await updateStandingsDashboard({
      guildId: "guild-1",
      channelId: "channel-1",
      matches: WORLD_CUP_2026_SEED.matches,
      results: [],
      timeZone: "UTC",
      now: () => new Date("2026-06-11T12:00:00.000Z"),
      listStandingsPosts: () => [],
      recordStandingsPost: vi.fn(),
      renderPng: vi.fn(async () => {
        throw new Error("sharp failed");
      }),
      upsertStandingsMessage: vi.fn(async (message) => {
        postedMessages.push(message.content);
        expect(message.files).toEqual([]);
        return `message-${message.key}`;
      })
    });

    expect(result.posts).toEqual([
      {
        postKey: "groups_a_f",
        messageId: "message-groups_a_f",
        action: "posted",
        renderState: "text-fallback",
        renderError: "sharp failed"
      },
      {
        postKey: "groups_g_l",
        messageId: "message-groups_g_l",
        action: "posted",
        renderState: "text-fallback",
        renderError: "sharp failed"
      }
    ]);
    expect(postedMessages[0]).toContain("Dashboard image render failed: sharp failed");
    expect(postedMessages[0]).toContain("```text");
  });

  test("edits existing standings dashboard messages and preserves created time", async () => {
    const records: StoredStandingsPost[] = existingPosts();
    const upsertStandingsMessage = vi.fn(async (_message, existingMessageId) => {
      if (!existingMessageId) {
        throw new Error("expected existing message id");
      }

      return existingMessageId;
    });

    const result = await updateStandingsDashboard({
      guildId: "guild-1",
      channelId: "channel-1",
      matches: WORLD_CUP_2026_SEED.matches,
      results: [],
      timeZone: "UTC",
      now: () => new Date("2026-06-11T12:05:00.000Z"),
      listStandingsPosts: () => records,
      recordStandingsPost: (post) => {
        records.splice(
          records.findIndex((candidate) => candidate.postKey === post.postKey),
          1,
          post
        );
      },
      upsertStandingsMessage
    });

    expect(result.posts).toEqual([
      {
        postKey: "groups_a_f",
        messageId: "message-a",
        action: "edited",
        renderState: "text-fallback"
      },
      {
        postKey: "groups_g_l",
        messageId: "message-b",
        action: "edited",
        renderState: "text-fallback"
      }
    ]);
    expect(records.map((record) => record.createdAt)).toEqual([
      "2026-06-11T12:00:00.000Z",
      "2026-06-11T12:00:00.000Z"
    ]);
    expect(records.map((record) => record.updatedAt)).toEqual([
      "2026-06-11T12:05:00.000Z",
      "2026-06-11T12:05:00.000Z"
    ]);
  });

  test("records a replacement when the adapter returns a new message id", async () => {
    const records: StoredStandingsPost[] = existingPosts();
    const upsertStandingsMessage = vi.fn(async (message, existingMessageId) =>
      message.key === "groups_a_f" && existingMessageId === "message-a"
        ? "replacement-a"
        : existingMessageId ?? `message-${message.key}`
    );

    const result = await updateStandingsDashboard({
      guildId: "guild-1",
      channelId: "channel-1",
      matches: WORLD_CUP_2026_SEED.matches,
      results: [],
      timeZone: "UTC",
      now: () => new Date("2026-06-11T12:10:00.000Z"),
      listStandingsPosts: () => records,
      recordStandingsPost: (post) => {
        records.splice(
          records.findIndex((candidate) => candidate.postKey === post.postKey),
          1,
          post
        );
      },
      upsertStandingsMessage
    });

    expect(result.posts[0]).toEqual({
      postKey: "groups_a_f",
      messageId: "replacement-a",
      action: "replaced",
      renderState: "text-fallback"
    });
    expect(records[0]?.messageId).toBe("replacement-a");
  });
});

function existingPosts(): StoredStandingsPost[] {
  return [
    {
      postKey: "groups_a_f",
      guildId: "guild-1",
      channelId: "channel-1",
      messageId: "message-a",
      createdAt: "2026-06-11T12:00:00.000Z",
      updatedAt: "2026-06-11T12:00:00.000Z"
    },
    {
      postKey: "groups_g_l",
      guildId: "guild-1",
      channelId: "channel-1",
      messageId: "message-b",
      createdAt: "2026-06-11T12:00:00.000Z",
      updatedAt: "2026-06-11T12:00:00.000Z"
    }
  ];
}
