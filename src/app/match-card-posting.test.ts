import { describe, expect, test, vi } from "vitest";

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
      matchdayRolloverTime: "06:00",
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
      matchdayRolloverTime: "06:00",
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

  test("posts after-midnight local matches on the previous matchday", async () => {
    const sent: MatchCardMessage[] = [];

    const result = await postDueMatchCards({
      matches: [
        {
          ...match("wc2026-008", 8, "2026-06-14"),
          kickoffAtUtc: "2026-06-14T04:00:00.000Z"
        }
      ],
      channelId: "channel-1",
      date: "2026-06-13",
      postSource: "auto",
      timeZone: "America/Sao_Paulo",
      matchdayRolloverTime: "06:00",
      now: () => new Date("2026-06-13T12:00:00.000Z"),
      listPostedMatchCards: () => [],
      sendMatchCard: async (message) => {
        sent.push(message);
        return "daily-message-3";
      },
      recordPostedMatchCard: () => undefined
    });

    expect(result).toEqual({
      posted: ["wc2026-008"],
      skipped: []
    });
    expect(sent).toHaveLength(1);
  });

  test("does not post unresolved knockout placeholder matches", async () => {
    const sendMatchCard = vi.fn(async () => "daily-message-4");
    const recordPostedMatchCard = vi.fn();

    const result = await postDueMatchCards({
      matches: [
        knockoutMatch(
          "wc2026-073",
          73,
          "2A",
          "2º Grupo A",
          "2B",
          "2º Grupo B",
          "2026-06-28T19:00:00.000Z"
        )
      ],
      channelId: "channel-1",
      date: "2026-06-28",
      postSource: "auto",
      timeZone: "America/Sao_Paulo",
      matchdayRolloverTime: "06:00",
      now: () => new Date("2026-06-26T12:00:00.000Z"),
      listPostedMatchCards: () => [],
      sendMatchCard,
      recordPostedMatchCard
    });

    expect(result).toEqual({
      posted: [],
      skipped: []
    });
    expect(sendMatchCard).not.toHaveBeenCalled();
    expect(recordPostedMatchCard).not.toHaveBeenCalled();
  });

  test("posts resolved knockout matches with concrete team names", async () => {
    const sent: MatchCardMessage[] = [];

    const result = await postDueMatchCards({
      matches: [
        knockoutMatch(
          "wc2026-073",
          73,
          "RSA",
          "South Africa",
          "BIH",
          "Bosnia and Herzegovina",
          "2026-06-28T19:00:00.000Z"
        )
      ],
      channelId: "channel-1",
      date: "2026-06-28",
      postSource: "auto",
      timeZone: "America/Sao_Paulo",
      matchdayRolloverTime: "06:00",
      now: () => new Date("2026-06-28T12:00:00.000Z"),
      listPostedMatchCards: () => [],
      sendMatchCard: async (message) => {
        sent.push(message);
        return "daily-message-5";
      },
      recordPostedMatchCard: () => undefined
    });

    expect(result).toEqual({
      posted: ["wc2026-073"],
      skipped: []
    });
    expect(sent[0]?.embeds?.[0]?.toJSON().fields?.[0]?.value).toContain(
      "África do Sul x Bósnia e Herzegovina"
    );
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

function knockoutMatch(
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
    phase: "round_of_32",
    group: null,
    homeTeam: { code: homeCode, name: homeName },
    awayTeam: { code: awayCode, name: awayName },
    localDate: kickoffAtUtc.slice(0, 10),
    kickoffTimeLocal: "16:00",
    kickoffAtUtc,
    venue: "Test Stadium",
    sourceId: "test-source",
    externalIds: {}
  };
}
