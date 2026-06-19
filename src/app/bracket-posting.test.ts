import { Buffer } from "node:buffer";

import { describe, expect, test, vi } from "vitest";

import { updateBracketDashboard } from "./bracket-posting.js";
import type { BracketDashboardMessage } from "../bracket/format.js";
import type { StoredBracketPost } from "../storage/database.js";
import { WORLD_CUP_2026_SEED } from "../worldcup/seed.js";

describe("updateBracketDashboard", () => {
  test("posts and records the bracket dashboard when none exists", async () => {
    const records: StoredBracketPost[] = [];
    const png = Buffer.from("png");
    const renderPng = vi.fn(async (svg: string) => {
      expect(svg).toContain("<svg");
      return png;
    });
    const upsertBracketMessage = vi.fn(async (message, existingMessageId) => {
      expect(existingMessageId).toBeNull();
      expect(message.content).toContain("World Cup 2026 Bracket");
      expect(message.content).toContain("2026-06-11 12:00 UTC");
      expect(message.files[0]?.attachment).toBe(png);
      return "bracket-message-1";
    });

    const result = await updateBracketDashboard({
      ...baseOptions(),
      listBracketPosts: () => records,
      recordBracketPost: (post) => records.push(post),
      renderPng,
      upsertBracketMessage
    });

    expect(result).toEqual({
      action: "updated",
      post: {
        messageId: "bracket-message-1",
        action: "posted"
      },
      bracketPhase: "provisional",
      renderState: "image"
    });
    expect(records).toEqual([
      {
        guildId: "guild-1",
        channelId: "channel-1",
        messageId: "bracket-message-1",
        createdAt: "2026-06-11T12:00:00.000Z",
        updatedAt: "2026-06-11T12:00:00.000Z"
      }
    ]);
  });

  test("edits an existing bracket dashboard and preserves created time", async () => {
    const records: StoredBracketPost[] = [existingPost()];
    const upsertBracketMessage = vi.fn(async (_message, existingMessageId) => {
      expect(existingMessageId).toBe("bracket-message-1");
      return "bracket-message-1";
    });

    const result = await updateBracketDashboard({
      ...baseOptions(new Date("2026-06-11T12:05:00.000Z")),
      listBracketPosts: () => records,
      recordBracketPost: (post) => {
        records.splice(0, records.length, post);
      },
      renderPng: vi.fn(async () => Buffer.from("png")),
      upsertBracketMessage
    });

    expect(result.post).toEqual({
      messageId: "bracket-message-1",
      action: "edited"
    });
    expect(records[0]).toEqual({
      guildId: "guild-1",
      channelId: "channel-1",
      messageId: "bracket-message-1",
      createdAt: "2026-06-11T12:00:00.000Z",
      updatedAt: "2026-06-11T12:05:00.000Z"
    });
  });

  test("records a replacement when the adapter returns a new message id", async () => {
    const records: StoredBracketPost[] = [existingPost()];

    const result = await updateBracketDashboard({
      ...baseOptions(new Date("2026-06-11T12:10:00.000Z")),
      listBracketPosts: () => records,
      recordBracketPost: (post) => {
        records.splice(0, records.length, post);
      },
      renderPng: vi.fn(async () => Buffer.from("png")),
      upsertBracketMessage: vi.fn(async () => "replacement-message")
    });

    expect(result.post).toEqual({
      messageId: "replacement-message",
      action: "replaced"
    });
    expect(records[0]?.messageId).toBe("replacement-message");
  });

  test("records a text-only fallback when rendering throws", async () => {
    const postedMessages: BracketDashboardMessage[] = [];

    const result = await updateBracketDashboard({
      ...baseOptions(),
      listBracketPosts: () => [],
      recordBracketPost: vi.fn(),
      renderPng: vi.fn(async () => {
        throw new Error("sharp failed");
      }),
      upsertBracketMessage: vi.fn(async (message) => {
        postedMessages.push(message);
        return "bracket-message-1";
      })
    });

    expect(result.renderState).toBe("text-fallback");
    expect(result.renderError).toBe("sharp failed");
    expect(postedMessages[0]?.files).toEqual([]);
    expect(postedMessages[0]?.content).toContain("Dashboard image render failed: sharp failed");
  });
});

function baseOptions(now = new Date("2026-06-11T12:00:00.000Z")) {
  return {
    guildId: "guild-1",
    channelId: "channel-1",
    matches: WORLD_CUP_2026_SEED.matches,
    results: [],
    timeZone: "UTC",
    now: () => now
  };
}

function existingPost(): StoredBracketPost {
  return {
    guildId: "guild-1",
    channelId: "channel-1",
    messageId: "bracket-message-1",
    createdAt: "2026-06-11T12:00:00.000Z",
    updatedAt: "2026-06-11T12:00:00.000Z"
  };
}
