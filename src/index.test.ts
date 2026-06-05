import { describe, expect, test, vi } from "vitest";

import { runCli } from "./index.js";
import type { CliStore } from "./index.js";
import type { CopanalhasConfig } from "./discord/config.js";
import type { MatchCardMessage } from "./discord/components.js";

describe("runCli", () => {
  test("prints a leaderboard from stored predictions and results", async () => {
    const lines: string[] = [];
    const store = createStore({
      listPredictions: () => [
        {
          userId: "u1",
          matchId: "wc2026-001",
          messageId: "m1",
          homeScore: 2,
          awayScore: 1,
          submittedAt: "2026-06-10T12:00:00.000Z",
          updatedAt: null,
          parserVersion: "prediction-parser-v1"
        },
        {
          userId: "u2",
          matchId: "wc2026-001",
          messageId: "m2",
          homeScore: 1,
          awayScore: 1,
          submittedAt: "2026-06-10T12:01:00.000Z",
          updatedAt: null,
          parserVersion: "prediction-parser-v1"
        }
      ],
      listResults: () => [
        {
          matchId: "wc2026-001",
          homeScore: 2,
          awayScore: 1,
          recordedAt: "2026-06-11T23:00:00.000Z",
          resultSource: "manual",
          externalMatchId: null,
          fetchedAt: null
        }
      ]
    });

    await runCli(["leaderboard"], {
      openDatabase: () => store,
      writeLine: (line) => lines.push(line),
      env: {},
      startDiscord: async () => undefined
    });

    expect(lines).toEqual([
      [
        "Copanalhas Leaderboard",
        "1. u1 - 3 pts (1 exact, 0 closest, 1 match)",
        "2. u2 - 1 pt (0 exact, 1 closest, 1 match)"
      ].join("\n")
    ]);
  });

  test("seeds reviewed World Cup matches", async () => {
    const lines: string[] = [];
    const store = createStore();

    await runCli(["seed-matches"], {
      openDatabase: () => store,
      writeLine: (line) => lines.push(line),
      env: {},
      startDiscord: async () => undefined
    });

    expect(store.upsertMatches).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: "wc2026-001",
          matchNumber: 1
        })
      ])
    );
    expect(lines).toEqual(["Seeded 72 World Cup matches."]);
  });

  test("records a match result", async () => {
    const lines: string[] = [];
    const store = createStore();

    await runCli(["record-result", "wc2026-001", "2", "1"], {
      openDatabase: () => store,
      writeLine: (line) => lines.push(line),
      env: {},
      startDiscord: async () => undefined
    });

    expect(store.upsertResult).toHaveBeenCalledWith({
      matchId: "wc2026-001",
      homeScore: 2,
      awayScore: 1,
      recordedAt: expect.any(String),
      resultSource: "manual",
      externalMatchId: null,
      fetchedAt: null
    });
    expect(lines).toEqual(["Recorded result wc2026-001 2-1."]);
  });

  test("clears posted match card records for a selected date", async () => {
    const lines: string[] = [];
    const store = createStore({
      clearPostedMatchCardsForDate: vi.fn(() => 2)
    });

    await runCli(["clear-posted-date", "2026-06-11"], {
      openDatabase: () => store,
      writeLine: (line) => lines.push(line),
      env: {
        DISCORD_CHANNEL_ID: "channel-1",
        COPANALHAS_DATABASE_PATH: "./tmp/copanalhas.sqlite"
      },
      startDiscord: async () => undefined
    });

    expect(store.migrate).toHaveBeenCalledOnce();
    expect(store.clearPostedMatchCardsForDate).toHaveBeenCalledWith("channel-1", "2026-06-11");
    expect(store.close).toHaveBeenCalledOnce();
    expect(lines).toEqual([
      "Cleared 2 posted match card records for 2026-06-11. Predictions, results, and standings were not touched."
    ]);
  });

  test("requires a channel id before clearing posted match card records", async () => {
    const lines: string[] = [];

    await runCli(["clear-posted-date", "2026-06-11"], {
      openDatabase: () => {
        throw new Error("database should not open");
      },
      writeLine: (line) => lines.push(line),
      env: {},
      startDiscord: async () => undefined
    });

    expect(lines).toEqual(["DISCORD_CHANNEL_ID is required"]);
  });

  test("posts match cards for a selected World Cup date", async () => {
    const lines: string[] = [];
    const postMatchCards = vi.fn(
      async (_config: CopanalhasConfig, _messages: MatchCardMessage[]) => undefined
    );

    await runCli(["post-matches-today", "2026-06-11"], {
      openDatabase: () => {
        throw new Error("database should not open");
      },
      writeLine: (line) => lines.push(line),
      env: {
        DISCORD_BOT_TOKEN: "token-value",
        DISCORD_GUILD_ID: "guild-1",
        DISCORD_CHANNEL_ID: "channel-1"
      },
      startDiscord: async () => undefined,
      postMatchCards
    });

    expect(postMatchCards).toHaveBeenCalledWith(
      expect.objectContaining({
        discordToken: "token-value",
        guildId: "guild-1",
        channelId: "channel-1",
        databasePath: "./data/copanalhas.sqlite"
      }),
      [
        expect.objectContaining({
          content: "JOGOS DO DIA",
          embeds: expect.arrayContaining([expect.anything()]),
          components: expect.arrayContaining([expect.anything()])
        })
      ]
    );
    const postedMessages = vi.mocked(postMatchCards).mock.calls[0]?.[1];
    const postedMessage = postedMessages?.[0];

    if (!postedMessage) {
      throw new Error("expected a grouped matchday message");
    }

    const matchdayEmbed = postedMessage.embeds?.[0]?.toJSON();

    expect(matchdayEmbed).toMatchObject({
      title: "quinta-feira, 11 de junho de 2026",
      description: "Use os botões abaixo para enviar seu palpite."
    });
    expect(matchdayEmbed?.fields?.map((field) => field.value)).toEqual([
      expect.stringContaining("México x África do Sul"),
      expect.stringContaining("Coreia do Sul x Tchéquia")
    ]);
    expect(postedMessage.components[0]?.toJSON()).toMatchObject({
      components: [
        { custom_id: "copanalhas:predict:wc2026-001", label: "Palpite #1" },
        { custom_id: "copanalhas:predict:wc2026-002", label: "Palpite #2" }
      ]
    });
    expect(lines).toEqual(["Posted 1 matchday card for 2 matches on 2026-06-11."]);
  });

  test("prints a local standings preview with simulated first-day results", async () => {
    const lines: string[] = [];

    await runCli(["standings-preview"], {
      openDatabase: () => {
        throw new Error("database should not open");
      },
      writeLine: (line) => lines.push(line),
      env: {},
      startDiscord: async () => undefined
    });

    const output = lines.join("\n");

    expect(output).toContain("World Cup 2026 Group Standings");
    expect(output).toContain("Groups A-F");
    expect(output).toContain("Groups G-L");
    expect(output).toContain("| GROUP A                | GROUP B                | GROUP C                |");
    expect(output).toContain("México");
    expect(output).toContain("Bósnia e Herz.");
    expect(output).toContain("Brasil");
    expect(output).not.toContain("| MEX  3");
  });

  test("starts the Discord bot with parsed environment config", async () => {
    const lines: string[] = [];
    const store = createStore();
    const startDiscord = vi.fn(async () => undefined);
    const startInterval = vi.fn(() => ({ stop: vi.fn() }));

    await runCli(["bot"], {
      openDatabase: () => store,
      writeLine: (line) => lines.push(line),
      env: {
        DISCORD_BOT_TOKEN: "token-value",
        DISCORD_GUILD_ID: "guild-1",
        DISCORD_CHANNEL_ID: "channel-1",
        COPANALHAS_DATABASE_PATH: "./tmp/bot.sqlite"
      },
      startDiscord,
      startInterval,
      sendMatchCard: vi.fn(async () => "discord-message-1"),
      upsertStandingsMessage: vi.fn(async (message) => `standings-${message.key}`),
      upsertLeaderboardMessage: vi.fn(async () => "leaderboard-message-1"),
      now: () => new Date("2026-06-11T12:00:00.000Z")
    });

    expect(store.upsertMatches).toHaveBeenCalled();
    expect(startDiscord).toHaveBeenCalledWith(
      expect.objectContaining({
        discordToken: "token-value",
        guildId: "guild-1",
        channelId: "channel-1",
        databasePath: "./tmp/bot.sqlite"
      }),
      expect.any(Function),
      expect.objectContaining({
        guildId: "guild-1",
        channelId: "channel-1",
        matches: expect.arrayContaining([
          expect.objectContaining({
            id: "wc2026-001",
            matchNumber: 1
          })
        ]),
        upsertPrediction: expect.any(Function)
      }),
      expect.objectContaining({
        operatorCommandOptions: expect.objectContaining({
          guildId: "guild-1",
          channelId: "channel-1"
        }),
        registerCommands: expect.any(Function)
      })
    );
    expect(startInterval).toHaveBeenCalled();
    expect(lines).toEqual([
      "Starting Discord collector for configured channel.",
      "Autonomous operator enabled. Auto-post: on at 09:00 America/Sao_Paulo."
    ]);
  });

  test("prints config errors before starting the bot", async () => {
    const lines: string[] = [];
    const startDiscord = vi.fn(async () => undefined);

    await runCli(["bot"], {
      openDatabase: () => {
        throw new Error("database should not open");
      },
      writeLine: (line) => lines.push(line),
      env: {},
      startDiscord
    });

    expect(startDiscord).not.toHaveBeenCalled();
    expect(lines).toEqual([
      "DISCORD_BOT_TOKEN is required",
      "DISCORD_GUILD_ID is required",
      "DISCORD_CHANNEL_ID is required"
    ]);
  });

  test("prints usage for unknown commands", async () => {
    const lines: string[] = [];

    await runCli(["wat"], {
      openDatabase: () => {
        throw new Error("database should not open");
      },
      writeLine: (line) => lines.push(line),
      env: {},
      startDiscord: async () => undefined
    });

    expect(lines).toEqual([
      "Usage: npm run dev -- seed-matches | post-matches-today [YYYY-MM-DD] | clear-posted-date [YYYY-MM-DD] | record-result <matchId> <homeScore> <awayScore> | leaderboard | standings-preview | bot"
    ]);
  });
});

function createStore(overrides: Partial<CliStore> = {}): CliStore {
  return {
    ...createStoreShape(),
    ...overrides
  };
}

function createStoreShape(): CliStore {
  return {
    migrate: vi.fn(),
    upsertMatches: vi.fn(),
    upsertPrediction: vi.fn(),
    upsertResult: vi.fn(),
    listPredictions: vi.fn(() => [] as ReturnType<CliStore["listPredictions"]>),
    listResults: vi.fn(() => [] as ReturnType<CliStore["listResults"]>),
    listPostedMatchCards: vi.fn(() => [] as ReturnType<CliStore["listPostedMatchCards"]>),
    recordPostedMatchCard: vi.fn(),
    clearPostedMatchCardsForDate: vi.fn(() => 0),
    clearPredictionsForMatches: vi.fn(() => 0),
    clearResultsForMatches: vi.fn(() => 0),
    listStandingsPosts: vi.fn(() => [] as ReturnType<CliStore["listStandingsPosts"]>),
    recordStandingsPost: vi.fn(),
    listLeaderboardPosts: vi.fn(() => [] as ReturnType<CliStore["listLeaderboardPosts"]>),
    recordLeaderboardPost: vi.fn(),
    insertScoringRun: vi.fn(),
    close: vi.fn()
  };
}
