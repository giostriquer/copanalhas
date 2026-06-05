import { describe, expect, test, vi } from "vitest";

import { updateStandingsDashboard } from "./standings-posting.js";
import type { StoredStandingsPost } from "../storage/database.js";
import { WORLD_CUP_2026_SEED } from "../worldcup/seed.js";

describe("updateStandingsDashboard", () => {
  test("posts and records both standings dashboard messages when none exist", async () => {
    const records: StoredStandingsPost[] = [];
    const upsertStandingsMessage = vi.fn(async (message, existingMessageId) => {
      expect(existingMessageId).toBeNull();
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
      upsertStandingsMessage
    });

    expect(result).toEqual({
      action: "updated",
      posts: [
        { postKey: "groups_a_f", messageId: "message-groups_a_f", action: "posted" },
        { postKey: "groups_g_l", messageId: "message-groups_g_l", action: "posted" }
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
      { postKey: "groups_a_f", messageId: "message-a", action: "edited" },
      { postKey: "groups_g_l", messageId: "message-b", action: "edited" }
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
      action: "replaced"
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
