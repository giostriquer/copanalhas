import { describe, expect, test } from "vitest";

import { postDueMatchCards } from "./match-card-posting.js";
import type { MatchCardMessage } from "../discord/components.js";
import type { WorldCupMatch } from "../worldcup/types.js";

describe("postDueMatchCards", () => {
  test("posts one grouped message for all due matches on the date", async () => {
    const sent: MatchCardMessage[] = [];
    const recorded: Array<{ matchId: string; messageId: string }> = [];

    const result = await postDueMatchCards({
      matches: [match("wc2026-001", 1, "2026-06-11"), match("wc2026-002", 2, "2026-06-11")],
      channelId: "channel-1",
      date: "2026-06-11",
      postSource: "command",
      timeZone: "UTC",
      now: () => new Date("2026-06-11T12:00:00.000Z"),
      listPostedMatchCards: () => [],
      sendMatchCard: async (message) => {
        sent.push(message);
        return "daily-message-1";
      },
      recordPostedMatchCard: (card) => {
        recorded.push({ matchId: card.matchId, messageId: card.messageId });
      }
    });

    expect(result).toEqual({
      posted: ["wc2026-001", "wc2026-002"],
      skipped: []
    });
    expect(sent).toHaveLength(1);
    expect(sent[0]?.content).toBe("JOGOS DO DIA");
    const fields = sent[0]?.embeds?.[0]?.toJSON().fields ?? [];

    expect(fields.map((field) => field.value)).toEqual([
      expect.stringContaining("Home 1 x Away 1"),
      expect.stringContaining("Home 2 x Away 2")
    ]);
    expect(recorded).toEqual([
      { matchId: "wc2026-001", messageId: "daily-message-1" },
      { matchId: "wc2026-002", messageId: "daily-message-1" }
    ]);
  });

  test("posts only cards not already recorded for the channel", async () => {
    const sent: Array<{ matchId: string; message: MatchCardMessage }> = [];
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
      sendMatchCard: async (message) => {
        sent.push({ matchId: "daily", message });
        return "daily-message-2";
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
        matchId: "daily",
        message: expect.objectContaining({
          content: "JOGOS DO DIA",
          embeds: expect.arrayContaining([expect.anything()])
        })
      }
    ]);
    expect(sent[0]?.message.embeds?.[0]?.toJSON().fields?.[0]?.value).toContain(
      "Home 2 x Away 2"
    );
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
