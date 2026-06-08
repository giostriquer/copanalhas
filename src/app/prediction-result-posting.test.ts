import { describe, expect, test, vi } from "vitest";

import { postDuePredictionResultReveals } from "./prediction-result-posting.js";
import type {
  StoredPrediction,
  StoredPredictionRevealPost,
  StoredResult
} from "../storage/database.js";
import type { WorldCupMatch } from "../worldcup/types.js";

describe("postDuePredictionResultReveals", () => {
  test("edits a locked reveal message once every match in that reveal has a result", async () => {
    const records = [
      revealPost("wc2026-001", "thread-1", "message-1"),
      revealPost("wc2026-002", "thread-1", "message-1")
    ];
    const editPredictionReveal = vi.fn(async () => undefined);

    const result = await postDuePredictionResultReveals({
      channelId: "channel-1",
      matches: [
        match("wc2026-001", 1, "MEX", "Mexico", "RSA", "South Africa"),
        match("wc2026-002", 2, "KOR", "Korea Republic", "CZE", "Czechia")
      ],
      predictions: [
        prediction("user-1", "wc2026-001", 1, 0),
        prediction("user-2", "wc2026-002", 2, 1)
      ],
      results: [matchResult("wc2026-001", 1, 0), matchResult("wc2026-002", 1, 1)],
      now: () => new Date("2026-06-12T04:30:00.000Z"),
      listPredictionRevealPosts: () => records,
      editPredictionReveal,
      recordPredictionRevealPost: (post) => {
        const index = records.findIndex(
          (record) => record.matchId === post.matchId && record.channelId === post.channelId
        );
        records.splice(index, 1, post);
      }
    });

    expect(result).toEqual({
      edited: [
        {
          matchIds: ["wc2026-001", "wc2026-002"],
          threadId: "thread-1",
          messageId: "message-1"
        }
      ],
      skipped: []
    });
    expect(editPredictionReveal).toHaveBeenCalledWith({
      threadId: "thread-1",
      messageId: "message-1",
      content: expect.stringContaining("Resultado")
    });
    expect(editPredictionReveal).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining("#1 México (1) x (0) África do Sul")
      })
    );
    expect(records.map((record) => record.resultRevealedAt)).toEqual([
      "2026-06-12T04:30:00.000Z",
      "2026-06-12T04:30:00.000Z"
    ]);
  });

  test("waits when a grouped reveal message has a match without a result", async () => {
    const editPredictionReveal = vi.fn(async () => undefined);

    const result = await postDuePredictionResultReveals({
      channelId: "channel-1",
      matches: [
        match("wc2026-001", 1, "MEX", "Mexico", "RSA", "South Africa"),
        match("wc2026-002", 2, "KOR", "Korea Republic", "CZE", "Czechia")
      ],
      predictions: [],
      results: [matchResult("wc2026-001", 1, 0)],
      now: () => new Date("2026-06-12T04:30:00.000Z"),
      listPredictionRevealPosts: () => [
        revealPost("wc2026-001", "thread-1", "message-1"),
        revealPost("wc2026-002", "thread-1", "message-1")
      ],
      editPredictionReveal,
      recordPredictionRevealPost: vi.fn()
    });

    expect(result).toEqual({ edited: [], skipped: ["wc2026-001", "wc2026-002"] });
    expect(editPredictionReveal).not.toHaveBeenCalled();
  });

  test("does not edit reveal messages that were already finalized", async () => {
    const editPredictionReveal = vi.fn(async () => undefined);

    const result = await postDuePredictionResultReveals({
      channelId: "channel-1",
      matches: [match("wc2026-001", 1, "MEX", "Mexico", "RSA", "South Africa")],
      predictions: [prediction("user-1", "wc2026-001", 1, 0)],
      results: [matchResult("wc2026-001", 1, 0)],
      now: () => new Date("2026-06-12T04:30:00.000Z"),
      listPredictionRevealPosts: () => [
        {
          ...revealPost("wc2026-001", "thread-1", "message-1"),
          resultRevealedAt: "2026-06-12T04:00:00.000Z"
        }
      ],
      editPredictionReveal,
      recordPredictionRevealPost: vi.fn()
    });

    expect(result).toEqual({ edited: [], skipped: ["wc2026-001"] });
    expect(editPredictionReveal).not.toHaveBeenCalled();
  });

  test("ignores reveal posts from other channels", async () => {
    const editPredictionReveal = vi.fn(async () => undefined);

    const result = await postDuePredictionResultReveals({
      channelId: "channel-1",
      matches: [match("wc2026-001", 1, "MEX", "Mexico", "RSA", "South Africa")],
      predictions: [prediction("user-1", "wc2026-001", 1, 0)],
      results: [matchResult("wc2026-001", 1, 0)],
      now: () => new Date("2026-06-12T04:30:00.000Z"),
      listPredictionRevealPosts: () => [
        {
          ...revealPost("wc2026-001", "thread-1", "message-1"),
          channelId: "other-channel"
        }
      ],
      editPredictionReveal,
      recordPredictionRevealPost: vi.fn()
    });

    expect(result).toEqual({ edited: [], skipped: [] });
    expect(editPredictionReveal).not.toHaveBeenCalled();
  });
});

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
    revealedAt: "2026-06-11T18:30:00.000Z",
    closeAtUtc: "2026-06-11T18:30:00.000Z",
    resultRevealedAt: null
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
    messageId: `message-${userId}-${matchId}`,
    homeScore,
    awayScore,
    submittedAt: "2026-06-11T10:00:00.000Z",
    updatedAt: null,
    parserVersion: "prediction-modal-v1"
  };
}

function matchResult(matchId: string, homeScore: number, awayScore: number): StoredResult {
  return {
    matchId,
    homeScore,
    awayScore,
    recordedAt: "2026-06-12T04:00:00.000Z",
    resultSource: "football-data",
    externalMatchId: "537327",
    fetchedAt: "2026-06-12T04:00:00.000Z"
  };
}

function match(
  id: string,
  matchNumber: number,
  homeCode: string,
  homeName: string,
  awayCode: string,
  awayName: string
): WorldCupMatch {
  return {
    id,
    matchNumber,
    phase: "group",
    group: "A",
    homeTeam: { code: homeCode, name: homeName },
    awayTeam: { code: awayCode, name: awayName },
    localDate: "2026-06-11",
    kickoffTimeLocal: "13:00",
    kickoffAtUtc: "2026-06-11T19:00:00.000Z",
    venue: "Test Stadium",
    sourceId: "test-source",
    externalIds: {}
  };
}
