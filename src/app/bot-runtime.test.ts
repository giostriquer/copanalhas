import { describe, expect, test, vi } from "vitest";

import { startCopanalhasBotRuntime, type BotRuntimeStore } from "./bot-runtime.js";
import type { CopanalhasConfig } from "../discord/config.js";
import type { DiscordIngestionResult } from "../discord/ingestion.js";
import type { PredictionInteractionOptions } from "../discord/interactions.js";
import type { OperatorCommandOptions } from "../discord/operator-commands.js";
import { WORLD_CUP_2026_SEED } from "../worldcup/seed.js";

describe("startCopanalhasBotRuntime", () => {
  test("composes storage, Discord handlers, operator commands, and scheduler", async () => {
    const store = createStore();
    const startDiscord = vi.fn(async () => ({ destroy: vi.fn(async () => undefined) }));
    const startInterval = vi.fn(() => ({ stop: vi.fn() }));
    const sendMatchCard = vi.fn(async () => "discord-message-1");
    const sendPredictionReveal = vi.fn(async () => ({
      threadId: "thread-1",
      messageId: "reveal-message-1"
    }));
    const upsertStandingsMessage = vi.fn(async (message) => `standings-${message.key}`);
    const upsertLeaderboardMessage = vi.fn(async () => "leaderboard-message-1");
    const writeLine = vi.fn();

    const runtime = await startCopanalhasBotRuntime({
      config: config(),
      store,
      matches: WORLD_CUP_2026_SEED.matches,
      startDiscord,
      startInterval,
      sendMatchCard,
      sendPredictionReveal,
      upsertStandingsMessage,
      upsertLeaderboardMessage,
      now: () => new Date("2026-06-11T12:00:00.000Z"),
      writeLine
    });

    expect(store.migrate).toHaveBeenCalled();
    expect(store.upsertMatches).toHaveBeenCalledWith(WORLD_CUP_2026_SEED.matches);
    expect(startDiscord).toHaveBeenCalledWith(
      config(),
      expect.any(Function),
      expect.objectContaining({
        matches: WORLD_CUP_2026_SEED.matches,
        upsertPrediction: expect.any(Function),
        now: expect.any(Function),
        timeZone: "America/Sao_Paulo"
      }),
      expect.objectContaining({
        operatorCommandOptions: expect.objectContaining({
          matches: WORLD_CUP_2026_SEED.matches,
          postDueMatchCards: expect.any(Function),
          upsertResult: expect.any(Function),
          updateStandingsDashboard: expect.any(Function),
          updateLeaderboardDashboard: expect.any(Function)
        }),
        registerCommands: expect.any(Function)
      })
    );
    expect(startInterval).toHaveBeenCalled();
    expect(upsertStandingsMessage).toHaveBeenCalledTimes(2);
    expect(store.recordStandingsPost).toHaveBeenCalledTimes(2);
    expect(upsertLeaderboardMessage).toHaveBeenCalledOnce();
    expect(store.recordLeaderboardPost).toHaveBeenCalledOnce();
    expect(writeLine).toHaveBeenCalledWith(
      "[dashboard] standings posts=2 posted=2 edited=0 replaced=0"
    );
    expect(writeLine).toHaveBeenCalledWith(
      "[dashboard] leaderboard action=posted message=leaderboard-message-1"
    );
    expect(writeLine).toHaveBeenCalledWith("[auto-post] date=2026-06-11 posted=2 skipped=0");

    await runtime.stop();
  });

  test("posts due matchday cards during startup catch-up", async () => {
    const store = createStore();
    const startDiscord = vi.fn(async () => ({ destroy: vi.fn(async () => undefined) }));
    const startInterval = vi.fn(() => ({ stop: vi.fn() }));
    const sendMatchCard = vi.fn(async () => "discord-message-1");

    await startCopanalhasBotRuntime({
      config: config(),
      store,
      matches: WORLD_CUP_2026_SEED.matches,
      startDiscord,
      startInterval,
      sendMatchCard,
      sendPredictionReveal: vi.fn(async () => ({
        threadId: "thread-1",
        messageId: "reveal-message-1"
      })),
      upsertStandingsMessage: vi.fn(async (message) => `standings-${message.key}`),
      upsertLeaderboardMessage: vi.fn(async () => "leaderboard-message-1"),
      now: () => new Date("2026-06-11T12:00:00.000Z"),
      writeLine: vi.fn()
    });

    expect(sendMatchCard).toHaveBeenCalledOnce();
    expect(store.recordPostedMatchCard).toHaveBeenCalledWith(
      expect.objectContaining({
        matchId: "wc2026-001",
        channelId: "channel-1",
        messageId: "discord-message-1",
        postedForDate: "2026-06-11",
        postSource: "auto"
      })
    );
    expect(store.recordPostedMatchCard).toHaveBeenCalledWith(
      expect.objectContaining({
        matchId: "wc2026-002",
        channelId: "channel-1",
        messageId: "discord-message-1",
        postedForDate: "2026-06-11",
        postSource: "auto"
      })
    );
  });

  test("posts due prediction reveals during startup catch-up", async () => {
    const store = {
      ...createStore(),
      listPostedMatchCards: vi.fn(() => [
        {
          matchId: "wc2026-001",
          channelId: "channel-1",
          messageId: "matchday-message-1",
          postedForDate: "2026-06-11",
          postedAt: "2026-06-11T12:00:00.000Z",
          postSource: "auto" as const
        }
      ]),
      listPredictions: vi.fn(() => [
        {
          userId: "user-1",
          matchId: "wc2026-001",
          messageId: "prediction-message-1",
          homeScore: 2,
          awayScore: 1,
          submittedAt: "2026-06-10T12:00:00.000Z",
          updatedAt: null,
          parserVersion: "prediction-modal-v1"
        }
      ])
    };
    const sendPredictionReveal = vi.fn(async () => ({
      threadId: "thread-1",
      messageId: "reveal-message-1"
    }));

    await startCopanalhasBotRuntime({
      config: config(),
      store,
      matches: WORLD_CUP_2026_SEED.matches,
      startDiscord: vi.fn(async () => ({ destroy: vi.fn(async () => undefined) })),
      startInterval: vi.fn(() => ({ stop: vi.fn() })),
      sendMatchCard: vi.fn(async () => "discord-message-1"),
      sendPredictionReveal,
      upsertStandingsMessage: vi.fn(async (message) => `standings-${message.key}`),
      upsertLeaderboardMessage: vi.fn(async () => "leaderboard-message-1"),
      now: () => new Date("2026-06-11T18:30:00.000Z"),
      writeLine: vi.fn()
    });

    expect(sendPredictionReveal).toHaveBeenCalledWith(
      expect.objectContaining({
        parentMessageId: "matchday-message-1",
        content: expect.stringContaining("#1 México x África do Sul")
      })
    );
    expect(store.recordPredictionRevealPost).toHaveBeenCalledWith(
      expect.objectContaining({
        matchId: "wc2026-001",
        channelId: "channel-1",
        threadId: "thread-1",
        messageId: "reveal-message-1"
      })
    );
  });

  test("refreshes the leaderboard after accepted predictions reach runtime handlers", async () => {
    const store = createStore();
    let onMessageResult: ((result: DiscordIngestionResult) => void | Promise<void>) | undefined;
    let predictionOptions: PredictionInteractionOptions | undefined;
    const startDiscord = vi.fn(async (_config, onMessage, interactionOptions) => {
      onMessageResult = onMessage;
      predictionOptions = interactionOptions;
      return { destroy: vi.fn(async () => undefined) };
    });
    const upsertLeaderboardMessage = vi.fn(async () => "leaderboard-message-1");

    await startCopanalhasBotRuntime({
      config: config(),
      store,
      matches: WORLD_CUP_2026_SEED.matches,
      startDiscord,
      startInterval: vi.fn(() => ({ stop: vi.fn() })),
      sendMatchCard: vi.fn(async () => "discord-message-1"),
      sendPredictionReveal: vi.fn(async () => ({
        threadId: "thread-1",
        messageId: "reveal-message-1"
      })),
      upsertStandingsMessage: vi.fn(async (message) => `standings-${message.key}`),
      upsertLeaderboardMessage,
      now: () => new Date("2026-06-11T12:00:00.000Z"),
      writeLine: vi.fn()
    });

    upsertLeaderboardMessage.mockClear();
    await predictionOptions?.refreshLeaderboardAfterPrediction?.();

    expect(upsertLeaderboardMessage).toHaveBeenCalledOnce();

    upsertLeaderboardMessage.mockClear();
    await onMessageResult?.({
      action: "accepted",
      prediction: {
        userId: "user-1",
        messageId: "message-1",
        matchNumber: 1,
        homeTeamCode: "MEX",
        awayTeamCode: "RSA",
        homeScore: 2,
        awayScore: 1,
        submittedAt: "2026-06-10T12:00:00.000Z",
        updatedAt: null,
        parserVersion: "prediction-parser-v1"
      }
    });

    expect(store.upsertPrediction).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        matchId: "wc2026-001"
      })
    );
    expect(upsertLeaderboardMessage).toHaveBeenCalledOnce();
  });

  test("refreshes standings after result sync stores final scores", async () => {
    const store = createStore();
    const intervalCallbacks: Array<() => void | Promise<void>> = [];
    const startDiscord = vi.fn(async () => ({ destroy: vi.fn(async () => undefined) }));
    const startInterval = vi.fn((callback) => {
      intervalCallbacks.push(callback);
      return { stop: vi.fn() };
    });
    const upsertStandingsMessage = vi.fn(async (message) => `standings-${message.key}`);
    const upsertLeaderboardMessage = vi.fn(async () => "leaderboard-message-1");
    const syncFinishedResults = vi.fn(async () => ({
      action: "synced" as const,
      storedResults: ["wc2026-001"],
      skipped: []
    }));

    await startCopanalhasBotRuntime({
      config: { ...config(), footballDataToken: "token-value", resultSyncEnabled: true },
      store,
      matches: WORLD_CUP_2026_SEED.matches,
      startDiscord,
      startInterval,
      sendMatchCard: vi.fn(async () => "discord-message-1"),
      sendPredictionReveal: vi.fn(async () => ({
        threadId: "thread-1",
        messageId: "reveal-message-1"
      })),
      upsertStandingsMessage,
      upsertLeaderboardMessage,
      syncFinishedResults,
      now: () => new Date("2026-06-11T12:00:00.000Z"),
      writeLine: vi.fn()
    });
    upsertStandingsMessage.mockClear();
    upsertLeaderboardMessage.mockClear();
    syncFinishedResults.mockClear();

    await intervalCallbacks[2]?.();

    expect(syncFinishedResults).toHaveBeenCalledOnce();
    expect(upsertStandingsMessage).toHaveBeenCalledTimes(2);
    expect(upsertLeaderboardMessage).toHaveBeenCalledOnce();
  });

  test("syncs recent results during startup catch-up when configured", async () => {
    const store = createStore();
    const startDiscord = vi.fn(async () => ({ destroy: vi.fn(async () => undefined) }));
    const startInterval = vi.fn(() => ({ stop: vi.fn() }));
    const upsertStandingsMessage = vi.fn(async (message) => `standings-${message.key}`);
    const upsertLeaderboardMessage = vi.fn(async () => "leaderboard-message-1");
    const writeLine = vi.fn();
    const syncFinishedResults = vi.fn(async () => ({
      action: "synced" as const,
      storedResults: ["wc2026-001"],
      skipped: []
    }));

    await startCopanalhasBotRuntime({
      config: { ...config(), footballDataToken: "token-value", resultSyncEnabled: true },
      store,
      matches: WORLD_CUP_2026_SEED.matches,
      startDiscord,
      startInterval,
      sendMatchCard: vi.fn(async () => "discord-message-1"),
      sendPredictionReveal: vi.fn(async () => ({
        threadId: "thread-1",
        messageId: "reveal-message-1"
      })),
      upsertStandingsMessage,
      upsertLeaderboardMessage,
      syncFinishedResults,
      now: () => new Date("2026-06-11T12:00:00.000Z"),
      writeLine
    });

    expect(syncFinishedResults).toHaveBeenCalledOnce();
    expect(syncFinishedResults).toHaveBeenCalledWith(
      expect.objectContaining({
        dateFrom: "2026-06-09",
        dateTo: "2026-06-11"
      })
    );
    expect(writeLine).toHaveBeenCalledWith(
      "[result-sync] range=2026-06-09..2026-06-11 synced stored=1 skipped=0"
    );
    expect(writeLine).toHaveBeenCalledWith(
      "[dashboard] standings posts=2 posted=2 edited=0 replaced=0"
    );
    expect(writeLine).toHaveBeenCalledWith(
      "[dashboard] leaderboard action=posted message=leaderboard-message-1"
    );
    expect(upsertStandingsMessage).toHaveBeenCalledTimes(4);
    expect(upsertLeaderboardMessage).toHaveBeenCalledTimes(2);
  });

  test("exposes runtime status from startup catch-up state", async () => {
    const postedCards: ReturnType<BotRuntimeStore["listPostedMatchCards"]> = [];
    const store = {
      ...createStore(),
      listPostedMatchCards: vi.fn(() => postedCards),
      recordPostedMatchCard: vi.fn((card) => {
        postedCards.push(card);
      })
    };
    let operatorOptions: OperatorCommandOptions | undefined;
    const startDiscord = vi.fn(async (_config, _onMessage, _predictionOptions, readyOptions) => {
      operatorOptions = readyOptions.operatorCommandOptions;
      return { destroy: vi.fn(async () => undefined) };
    });

    await startCopanalhasBotRuntime({
      config: config(),
      store,
      matches: WORLD_CUP_2026_SEED.matches,
      startDiscord,
      startInterval: vi.fn(() => ({ stop: vi.fn() })),
      sendMatchCard: vi.fn(async () => "discord-message-1"),
      sendPredictionReveal: vi.fn(async () => ({
        threadId: "thread-1",
        messageId: "reveal-message-1"
      })),
      upsertStandingsMessage: vi.fn(async (message) => `standings-${message.key}`),
      upsertLeaderboardMessage: vi.fn(async () => "leaderboard-message-1"),
      now: () => new Date("2026-06-11T12:00:00.000Z"),
      writeLine: vi.fn()
    });

    expect(operatorOptions?.getRuntimeStatus?.()).toMatchObject({
      localDate: "2026-06-11",
      localTime: "09:00",
      timeZone: "America/Sao_Paulo",
      autoPostEnabled: true,
      autoPostTime: "09:00",
      todayMatches: [
        {
          matchId: "wc2026-001",
          matchNumber: 1,
          label: "México x África do Sul",
          posted: true,
          predictionState: "open"
        },
        {
          matchId: "wc2026-002",
          matchNumber: 2,
          label: "Coreia do Sul x Tchéquia",
          posted: true,
          predictionState: "open"
        }
      ],
      lastAutoPost: {
        action: "posted",
        localDate: "2026-06-11",
        posted: ["wc2026-001", "wc2026-002"],
        skipped: []
      },
      resultSyncEnabled: false,
      lastResultSync: { action: "never" }
    });
  });

  test("keeps after-midnight matches on the previous operational matchday status", async () => {
    const postedCards: ReturnType<BotRuntimeStore["listPostedMatchCards"]> = [];
    const store = {
      ...createStore(),
      listPostedMatchCards: vi.fn(() => postedCards),
      recordPostedMatchCard: vi.fn((card) => {
        postedCards.push(card);
      })
    };
    let operatorOptions: OperatorCommandOptions | undefined;
    const startDiscord = vi.fn(async (_config, _onMessage, _predictionOptions, readyOptions) => {
      operatorOptions = readyOptions.operatorCommandOptions;
      return { destroy: vi.fn(async () => undefined) };
    });

    await startCopanalhasBotRuntime({
      config: config(),
      store,
      matches: WORLD_CUP_2026_SEED.matches,
      startDiscord,
      startInterval: vi.fn(() => ({ stop: vi.fn() })),
      sendMatchCard: vi.fn(async () => "discord-message-1"),
      sendPredictionReveal: vi.fn(async () => ({
        threadId: "thread-1",
        messageId: "reveal-message-1"
      })),
      upsertStandingsMessage: vi.fn(async (message) => `standings-${message.key}`),
      upsertLeaderboardMessage: vi.fn(async () => "leaderboard-message-1"),
      now: () => new Date("2026-06-14T03:15:00.000Z"),
      writeLine: vi.fn()
    });

    const status = operatorOptions?.getRuntimeStatus?.();

    expect(status).toMatchObject({
      localDate: "2026-06-13",
      localTime: "00:15",
      lastAutoPost: {
        action: "posted",
        localDate: "2026-06-13"
      }
    });
    expect(status?.todayMatches.map((match) => match.matchId)).toContain("wc2026-008");
  });
});

function config(): CopanalhasConfig {
  return {
    discordToken: "token-value",
    guildId: "guild-1",
    channelId: "channel-1",
    databasePath: "./data/copanalhas.sqlite",
    autoPostEnabled: true,
    autoPostTime: "09:00",
    timezone: "America/Sao_Paulo",
    matchdayRolloverTime: "06:00",
    footballDataToken: null,
    resultSyncEnabled: false
  };
}

function createStore(): BotRuntimeStore {
  return {
    migrate: vi.fn(),
    upsertMatches: vi.fn(),
    upsertPrediction: vi.fn(),
    upsertResult: vi.fn(),
    listPredictions: vi.fn(() => []),
    listResults: vi.fn(() => []),
    listPostedMatchCards: vi.fn(() => []),
    recordPostedMatchCard: vi.fn(),
    listPredictionRevealPosts: vi.fn(() => []),
    recordPredictionRevealPost: vi.fn(),
    clearPostedMatchCardsForDate: vi.fn(() => 0),
    clearPredictionsForMatches: vi.fn(() => 0),
    clearResultsForMatches: vi.fn(() => 0),
    clearPredictionRevealPostsForMatches: vi.fn(() => 0),
    listStandingsPosts: vi.fn(() => []),
    recordStandingsPost: vi.fn(),
    listLeaderboardPosts: vi.fn(() => []),
    recordLeaderboardPost: vi.fn(),
    insertScoringRun: vi.fn()
  };
}
