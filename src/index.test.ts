import { describe, expect, test, vi } from "vitest";

import { runCli } from "./index.js";
import type { CliStore } from "./index.js";

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
          recordedAt: "2026-06-11T23:00:00.000Z"
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
    expect(lines).toEqual(["Seeded 12 World Cup matches."]);
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
      recordedAt: expect.any(String)
    });
    expect(lines).toEqual(["Recorded result wc2026-001 2-1."]);
  });

  test("starts the Discord bot with parsed environment config", async () => {
    const lines: string[] = [];
    const store = createStore();
    const startDiscord = vi.fn(async () => undefined);

    await runCli(["bot"], {
      openDatabase: () => store,
      writeLine: (line) => lines.push(line),
      env: {
        DISCORD_BOT_TOKEN: "token-value",
        DISCORD_GUILD_ID: "guild-1",
        DISCORD_CHANNEL_ID: "channel-1",
        COPANALHAS_DATABASE_PATH: "./tmp/bot.sqlite"
      },
      startDiscord
    });

    expect(store.upsertMatches).toHaveBeenCalled();
    expect(startDiscord).toHaveBeenCalledWith(
      {
        discordToken: "token-value",
        guildId: "guild-1",
        channelId: "channel-1",
        databasePath: "./tmp/bot.sqlite"
      },
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
      })
    );
    expect(lines).toEqual(["Starting Discord collector for configured channel."]);
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
      "Usage: npm run dev -- seed-matches | record-result <matchId> <homeScore> <awayScore> | leaderboard | bot"
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
    close: vi.fn()
  };
}
