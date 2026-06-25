import { describe, expect, test, vi } from "vitest";

import { updateThirdPlaceDashboard } from "./third-place-posting.js";
import type { ThirdPlaceDashboardMessage } from "../third-place/format.js";
import type { StoredThirdPlacePost } from "../storage/database.js";
import { WORLD_CUP_2026_SEED } from "../worldcup/seed.js";

describe("updateThirdPlaceDashboard", () => {
  test("posts and records the third-place dashboard when none exists", async () => {
    const records: StoredThirdPlacePost[] = [];
    const upsertThirdPlaceMessage = vi.fn(async (message, existingMessageId) => {
      expect(existingMessageId).toBeNull();
      expect(message.files[0]?.name).toBe("copanalhas-third-places.png");

      return "third-place-message-1";
    });
    const result = await updateThirdPlaceDashboard({
      ...baseOptions(),
      listThirdPlacePosts: () => records,
      recordThirdPlacePost: (post) => records.push(post),
      renderPng: async () => Buffer.from("png"),
      upsertThirdPlaceMessage
    });

    expect(result).toEqual({
      action: "updated",
      post: { messageId: "third-place-message-1", action: "posted" },
      qualificationStatus: "needs-manual-tiebreaker",
      renderState: "image"
    });
    expect(records).toEqual([
      {
        guildId: "guild-1",
        channelId: "channel-1",
        messageId: "third-place-message-1",
        createdAt: "2026-06-24T21:00:00.000Z",
        updatedAt: "2026-06-24T21:00:00.000Z"
      }
    ]);
  });

  test("edits an existing third-place dashboard and preserves created time", async () => {
    const records: StoredThirdPlacePost[] = [
      {
        guildId: "guild-1",
        channelId: "channel-1",
        messageId: "third-place-message-1",
        createdAt: "2026-06-24T20:00:00.000Z",
        updatedAt: "2026-06-24T20:00:00.000Z"
      }
    ];
    const result = await updateThirdPlaceDashboard({
      ...baseOptions(),
      listThirdPlacePosts: () => records,
      recordThirdPlacePost: (post) => {
        records.splice(0, records.length, post);
      },
      renderPng: async () => Buffer.from("png"),
      upsertThirdPlaceMessage: vi.fn(async (_message, existingMessageId) => {
        expect(existingMessageId).toBe("third-place-message-1");
        return "third-place-message-1";
      })
    });

    expect(result.post.action).toBe("edited");
    expect(records[0]).toMatchObject({
      messageId: "third-place-message-1",
      createdAt: "2026-06-24T20:00:00.000Z",
      updatedAt: "2026-06-24T21:00:00.000Z"
    });
  });

  test("falls back to text when image rendering throws", async () => {
    const postedMessages: ThirdPlaceDashboardMessage[] = [];
    const result = await updateThirdPlaceDashboard({
      ...baseOptions(),
      listThirdPlacePosts: () => [],
      recordThirdPlacePost: vi.fn(),
      renderPng: async () => {
        throw new Error("sharp failed");
      },
      upsertThirdPlaceMessage: vi.fn(async (message) => {
        postedMessages.push(message);
        return "third-place-message-1";
      })
    });

    expect(result.renderState).toBe("text-fallback");
    expect(result.renderError).toBe("sharp failed");
    expect(postedMessages[0]?.content).toContain("Dashboard image render failed: sharp failed");
    expect(postedMessages[0]?.files).toEqual([]);
  });
});

function baseOptions() {
  return {
    guildId: "guild-1",
    channelId: "channel-1",
    matches: WORLD_CUP_2026_SEED.matches,
    results: [],
    timeZone: "America/Sao_Paulo",
    now: () => new Date("2026-06-24T21:00:00.000Z")
  };
}
