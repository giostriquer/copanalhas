import { describe, expect, test } from "vitest";

import { postDueMatchCards } from "./match-card-posting.js";
import type { WorldCupMatch } from "../worldcup/types.js";

describe("postDueMatchCards", () => {
  test("posts only cards not already recorded for the channel", async () => {
    const sent: Array<{ matchId: string; content: string }> = [];
    const recorded: string[] = ["wc2026-001"];

    const result = await postDueMatchCards({
      matches: [match("wc2026-001", 1, "2026-06-11"), match("wc2026-002", 2, "2026-06-11")],
      channelId: "channel-1",
      date: "2026-06-11",
      postSource: "auto",
      timeZone: "UTC",
      now: () => new Date("2026-06-11T12:00:00.000Z"),
      listPostedMatchCards: () =>
        recorded.map((matchId) => ({
          matchId,
          channelId: "channel-1",
          messageId: `message-${matchId}`,
          postedForDate: "2026-06-11",
          postedAt: "2026-06-11T09:00:00.000Z",
          postSource: "auto"
        })),
      sendMatchCard: async (matchId, message) => {
        sent.push({ matchId, content: message.content });
        return `message-${matchId}`;
      },
      recordPostedMatchCard: (card) => {
        recorded.push(card.matchId);
      }
    });

    expect(result).toEqual({
      posted: ["wc2026-002"],
      skipped: ["wc2026-001"]
    });
    expect(sent).toEqual([
      {
        matchId: "wc2026-002",
        content: expect.stringContaining("Home 2 vs Away 2")
      }
    ]);
    expect(recorded).toEqual(["wc2026-001", "wc2026-002"]);
  });
});

function match(id: string, matchNumber: number, localDate: string): WorldCupMatch {
  return {
    id,
    matchNumber,
    phase: "group",
    group: "A",
    homeTeam: { code: `H${matchNumber}`, name: `Home ${matchNumber}` },
    awayTeam: { code: `A${matchNumber}`, name: `Away ${matchNumber}` },
    localDate,
    kickoffTimeLocal: null,
    kickoffAtUtc: "2026-06-11T19:00:00.000Z",
    venue: "Test Stadium",
    sourceId: "test-source",
    externalIds: {}
  };
}
