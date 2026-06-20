import { describe, expect, test, vi } from "vitest";

import { postDuePredictionReveals, repostPredictionReveal } from "./prediction-reveal-posting.js";
import type {
  StoredPostedMatchCard,
  StoredPrediction,
  StoredPredictionRevealPost
} from "../storage/database.js";
import type { WorldCupMatch } from "../worldcup/types.js";

describe("postDuePredictionReveals", () => {
  test("posts one thread message for matches sharing a close time and parent matchday card", async () => {
    const records: StoredPredictionRevealPost[] = [];
    const sendPredictionReveal = vi.fn(async (message) => {
      expect(message.parentMessageId).toBe("matchday-message-1");
      expect(message.threadName).toBe("Palpites 2026-06-24");
      expect(message.content).toContain("#53 Tchéquia x México");
      expect(message.content).toContain("#54 África do Sul x Coreia do Sul");

      return { threadId: "thread-1", messageId: "reveal-message-1" };
    });

    const result = await postDuePredictionReveals({
      channelId: "channel-1",
      matches: [
        match("wc2026-053", 53, "CZE", "Czechia", "MEX", "Mexico", "2026-06-25T01:00:00.000Z"),
        match(
          "wc2026-054",
          54,
          "RSA",
          "South Africa",
          "KOR",
          "Korea Republic",
          "2026-06-25T01:00:00.000Z"
        )
      ],
      predictions: [
        prediction("user-1", "wc2026-053", 1, 2),
        prediction("user-2", "wc2026-054", 0, 1)
      ],
      now: () => new Date("2026-06-25T00:30:00.000Z"),
      listPostedMatchCards: () => [
        postedMatchCard("wc2026-053", "matchday-message-1", "2026-06-24"),
        postedMatchCard("wc2026-054", "matchday-message-1", "2026-06-24")
      ],
      listPredictionRevealPosts: () => [],
      sendPredictionReveal,
      recordPredictionRevealPost: (post) => records.push(post)
    });

    expect(result).toEqual({
      posted: [
        {
          matchIds: ["wc2026-053", "wc2026-054"],
          threadId: "thread-1",
          messageId: "reveal-message-1"
        }
      ],
      skipped: []
    });
    expect(sendPredictionReveal).toHaveBeenCalledOnce();
    expect(records).toEqual([
      {
        matchId: "wc2026-053",
        channelId: "channel-1",
        threadId: "thread-1",
        messageId: "reveal-message-1",
        revealedAt: "2026-06-25T00:30:00.000Z",
        closeAtUtc: "2026-06-25T00:30:00.000Z",
        resultRevealedAt: null
      },
      {
        matchId: "wc2026-054",
        channelId: "channel-1",
        threadId: "thread-1",
        messageId: "reveal-message-1",
        revealedAt: "2026-06-25T00:30:00.000Z",
        closeAtUtc: "2026-06-25T00:30:00.000Z",
        resultRevealedAt: null
      }
    ]);
  });

  test("does not repost matches already revealed for the channel", async () => {
    const sendPredictionReveal = vi.fn();

    const result = await postDuePredictionReveals({
      channelId: "channel-1",
      matches: [
        match("wc2026-001", 1, "MEX", "Mexico", "RSA", "South Africa", "2026-06-11T19:00:00.000Z")
      ],
      predictions: [],
      now: () => new Date("2026-06-11T18:30:00.000Z"),
      listPostedMatchCards: () => [postedMatchCard("wc2026-001", "matchday-message-1", "2026-06-11")],
      listPredictionRevealPosts: () => [
        {
          matchId: "wc2026-001",
          channelId: "channel-1",
          threadId: "thread-1",
          messageId: "reveal-message-1",
          revealedAt: "2026-06-11T18:30:00.000Z",
          closeAtUtc: "2026-06-11T18:30:00.000Z",
          resultRevealedAt: null
        }
      ],
      sendPredictionReveal,
      recordPredictionRevealPost: vi.fn()
    });

    expect(result).toEqual({ posted: [], skipped: ["wc2026-001"] });
    expect(sendPredictionReveal).not.toHaveBeenCalled();
  });
});

describe("repostPredictionReveal", () => {
  test("clears a stale grouped reveal record and reposts that reveal group", async () => {
    const records: StoredPredictionRevealPost[] = [
      revealPost("wc2026-053", "thread-1", "deleted-message-1"),
      revealPost("wc2026-054", "thread-1", "deleted-message-1"),
      revealPost("wc2026-055", "thread-2", "other-message-1")
    ];
    const clearPredictionRevealPostsForMatches = vi.fn((matchIds: readonly string[]) => {
      for (const matchId of matchIds) {
        const index = records.findIndex((record) => record.matchId === matchId);

        if (index >= 0) {
          records.splice(index, 1);
        }
      }

      return matchIds.length;
    });
    const sendPredictionReveal = vi.fn(async (message) => {
      expect(message.content).toContain("#53 Tchéquia x México");
      expect(message.content).toContain("#54 África do Sul x Coreia do Sul");
      expect(message.content).not.toContain("#55");

      return { threadId: "thread-3", messageId: "reveal-message-2" };
    });

    const result = await repostPredictionReveal({
      channelId: "channel-1",
      matchId: "wc2026-053",
      matches: [
        match("wc2026-053", 53, "CZE", "Czechia", "MEX", "Mexico", "2026-06-25T01:00:00.000Z"),
        match(
          "wc2026-054",
          54,
          "RSA",
          "South Africa",
          "KOR",
          "Korea Republic",
          "2026-06-25T01:00:00.000Z"
        ),
        match("wc2026-055", 55, "BRA", "Brazil", "MAR", "Morocco", "2026-06-26T01:00:00.000Z")
      ],
      predictions: [
        prediction("user-1", "wc2026-053", 1, 2),
        prediction("user-2", "wc2026-054", 0, 1)
      ],
      now: () => new Date("2026-06-25T00:30:00.000Z"),
      listPostedMatchCards: () => [
        postedMatchCard("wc2026-053", "matchday-message-1", "2026-06-24"),
        postedMatchCard("wc2026-054", "matchday-message-1", "2026-06-24"),
        postedMatchCard("wc2026-055", "matchday-message-2", "2026-06-25")
      ],
      listPredictionRevealPosts: () => records,
      clearPredictionRevealPostsForMatches,
      sendPredictionReveal,
      recordPredictionRevealPost: (post) => records.push(post)
    });

    expect(result).toEqual({
      cleared: 2,
      repostedMatchIds: ["wc2026-053", "wc2026-054"],
      posted: [
        {
          matchIds: ["wc2026-053", "wc2026-054"],
          threadId: "thread-3",
          messageId: "reveal-message-2"
        }
      ],
      skipped: []
    });
    expect(clearPredictionRevealPostsForMatches).toHaveBeenCalledWith([
      "wc2026-053",
      "wc2026-054"
    ]);
    expect(sendPredictionReveal).toHaveBeenCalledOnce();
  });
});

function prediction(
  userId: string,
  matchId: string,
  homeScore: number,
  awayScore: number
): StoredPrediction {
  return {
    userId,
    matchId,
    messageId: `message-${userId}-${matchId}`,
    homeScore,
    awayScore,
    submittedAt: "2026-06-24T10:00:00.000Z",
    updatedAt: null,
    parserVersion: "prediction-modal-v1"
  };
}

function postedMatchCard(
  matchId: string,
  messageId: string,
  postedForDate: string
): StoredPostedMatchCard {
  return {
    matchId,
    channelId: "channel-1",
    messageId,
    postedForDate,
    postedAt: "2026-06-24T12:00:00.000Z",
    postSource: "auto"
  };
}

function revealPost(
  matchId: string,
  threadId: string,
  messageId: string
): StoredPredictionRevealPost {
  return {
    matchId,
    channelId: "channel-1",
    threadId,
    messageId,
    revealedAt: "2026-06-25T00:30:00.000Z",
    closeAtUtc: "2026-06-25T00:30:00.000Z",
    resultRevealedAt: null
  };
}

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
    localDate: "2026-06-24",
    kickoffTimeLocal: "19:00",
    kickoffAtUtc,
    venue: "Test Stadium",
    sourceId: "test-source",
    externalIds: {}
  };
}
