import { describe, expect, test, vi } from "vitest";

import { startCopanalhasBotRuntime, type BotRuntimeStore } from "./bot-runtime.js";
import type { CopanalhasConfig } from "../discord/config.js";
import type { DiscordIngestionResult } from "../discord/ingestion.js";
import type { PredictionInteractionOptions } from "../discord/interactions.js";
import type { OperatorCommandOptions } from "../discord/operator-commands.js";
import type {
  StoredMatchStartAlert,
  StoredPredictionRevealPost,
  StoredResult
} from "../storage/database.js";
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
      now: () => new Date("2026-06-11T21:15:00.000Z"),
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
      "[2026-06-11T21:15:00.000Z][dashboard] standings posts=2 posted=2 edited=0 replaced=0"
    );
    expect(writeLine).toHaveBeenCalledWith(
      "[2026-06-11T21:15:00.000Z][dashboard] leaderboard action=posted message=leaderboard-message-1"
    );
    expect(writeLine).toHaveBeenCalledWith(
      "[2026-06-11T21:15:00.000Z][auto-post] date=2026-06-11 windowDays=3 posted=8 skipped=0"
    );
    expect(writeLine).toHaveBeenCalledWith(
      "[2026-06-11T21:15:00.000Z][health] discord=online guild=guild-1 channel=channel-1"
    );
    expect(writeLine).toHaveBeenCalledWith(
      "[2026-06-11T21:15:00.000Z][health] nextMatchday=2026-06-11 matches=2 posted=2/2"
    );
    expect(writeLine).toHaveBeenCalledWith(
      "[2026-06-11T21:15:00.000Z][health] dashboards standings=2/2 leaderboard=present lastLeaderboard=2026-06-11T21:15:00.000Z"
    );

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
      now: () => new Date("2026-06-11T21:15:00.000Z"),
      writeLine: vi.fn()
    });

    expect(sendMatchCard).toHaveBeenCalledTimes(3);
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

  test("posts match start alerts during startup when the role is configured", async () => {
    const alerts: StoredMatchStartAlert[] = [];
    const store = {
      ...createStore(),
      listMatchStartAlerts: vi.fn(() => alerts),
      recordMatchStartAlert: vi.fn((alert: StoredMatchStartAlert) => alerts.push(alert)),
      markMatchStartAlertsDeleted: vi.fn()
    };
    const sendMatchStartAlert = vi.fn(async () => "match-start-message-1");
    const writeLine = vi.fn();
    const [firstMatch] = WORLD_CUP_2026_SEED.matches;

    if (!firstMatch) {
      throw new Error("World Cup seed needs at least one match for runtime tests");
    }

    await startCopanalhasBotRuntime({
      config: { ...config(), matchStartRoleId: "role-canalhas" },
      store,
      matches: WORLD_CUP_2026_SEED.matches,
      startDiscord: vi.fn(async () => ({ destroy: vi.fn(async () => undefined) })),
      startInterval: vi.fn(() => ({ stop: vi.fn() })),
      sendMatchCard: vi.fn(async () => "discord-message-1"),
      sendPredictionReveal: vi.fn(async () => ({
        threadId: "thread-1",
        messageId: "reveal-message-1"
      })),
      sendMatchStartAlert,
      deleteMatchStartAlert: vi.fn(async () => undefined),
      upsertStandingsMessage: vi.fn(async (message) => `standings-${message.key}`),
      upsertLeaderboardMessage: vi.fn(async () => "leaderboard-message-1"),
      now: () => new Date("2026-06-11T19:00:20.000Z"),
      writeLine
    });

    expect(sendMatchStartAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining("PARTIDA COMEÇOU"),
        allowedMentions: { parse: [], roles: ["role-canalhas"] }
      })
    );
    expect(store.recordMatchStartAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        matchId: "wc2026-001",
        channelId: "channel-1",
        messageId: "match-start-message-1"
      })
    );
    expect(writeLine).toHaveBeenCalledWith(
      "[2026-06-11T19:00:20.000Z][match-start] posted=1 deleted=0 matches=wc2026-001 messages=none"
    );
  });

  test("deletes stored match start alerts during startup when results are present", async () => {
    const alerts: StoredMatchStartAlert[] = [
      {
        matchId: "wc2026-001",
        channelId: "channel-1",
        messageId: "match-start-message-1",
        postedAt: "2026-06-11T19:00:20.000Z",
        deleteAfterUtc: "2026-06-11T22:00:00.000Z",
        deletedAt: null
      }
    ];
    const store = {
      ...createStore(),
      listResults: vi.fn(() => [
        {
          matchId: "wc2026-001",
          homeScore: 2,
          awayScore: 0,
          recordedAt: "2026-06-11T21:00:00.000Z",
          resultSource: "manual" as const,
          externalMatchId: null,
          fetchedAt: null
        }
      ]),
      listMatchStartAlerts: vi.fn(() => alerts),
      recordMatchStartAlert: vi.fn(),
      markMatchStartAlertsDeleted: vi.fn((matchIds: readonly string[], deletedAt: string) => {
        let changes = 0;

        for (const alert of alerts) {
          if (matchIds.includes(alert.matchId)) {
            alert.deletedAt = deletedAt;
            changes += 1;
          }
        }

        return changes;
      })
    };
    const deleteMatchStartAlert = vi.fn(async () => undefined);
    const writeLine = vi.fn();

    await startCopanalhasBotRuntime({
      config: { ...config(), matchStartRoleId: "role-canalhas" },
      store,
      matches: WORLD_CUP_2026_SEED.matches,
      startDiscord: vi.fn(async () => ({ destroy: vi.fn(async () => undefined) })),
      startInterval: vi.fn(() => ({ stop: vi.fn() })),
      sendMatchCard: vi.fn(async () => "discord-message-1"),
      sendPredictionReveal: vi.fn(async () => ({
        threadId: "thread-1",
        messageId: "reveal-message-1"
      })),
      sendMatchStartAlert: vi.fn(async () => "match-start-message-2"),
      deleteMatchStartAlert,
      upsertStandingsMessage: vi.fn(async (message) => `standings-${message.key}`),
      upsertLeaderboardMessage: vi.fn(async () => "leaderboard-message-1"),
      now: () => new Date("2026-06-11T21:05:00.000Z"),
      writeLine
    });

    expect(deleteMatchStartAlert).toHaveBeenCalledWith("match-start-message-1");
    expect(store.markMatchStartAlertsDeleted).toHaveBeenCalledWith(
      ["wc2026-001"],
      "2026-06-11T21:05:00.000Z"
    );
    expect(writeLine).toHaveBeenCalledWith(
      "[2026-06-11T21:05:00.000Z][match-start] posted=0 deleted=1 matches=none messages=match-start-message-1"
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
    let now = new Date("2026-06-11T21:00:00.000Z");
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
      now: () => now,
      writeLine: vi.fn()
    });
    upsertStandingsMessage.mockClear();
    upsertLeaderboardMessage.mockClear();
    syncFinishedResults.mockClear();

    now = new Date("2026-06-11T21:15:00.000Z");
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
      now: () => new Date("2026-06-11T21:15:00.000Z"),
      writeLine
    });

    expect(syncFinishedResults).toHaveBeenCalledOnce();
    expect(syncFinishedResults).toHaveBeenCalledWith(
      expect.objectContaining({
        pendingMatchIds: ["wc2026-001"],
        dateFrom: "2026-06-11",
        dateTo: "2026-06-11"
      })
    );
    expect(writeLine).toHaveBeenCalledWith(
      "[2026-06-11T21:15:00.000Z][result-sync] start mode=scheduled range=2026-06-11..2026-06-11 pending=1"
    );
    expect(writeLine).toHaveBeenCalledWith(
      "[2026-06-11T21:15:00.000Z][result-sync] range=2026-06-11..2026-06-11 synced stored=1 skipped=0"
    );
    expect(writeLine).toHaveBeenCalledWith(
      "[2026-06-11T21:15:00.000Z][dashboard] standings posts=2 posted=2 edited=0 replaced=0"
    );
    expect(writeLine).toHaveBeenCalledWith(
      "[2026-06-11T21:15:00.000Z][dashboard] leaderboard action=posted message=leaderboard-message-1"
    );
    expect(upsertStandingsMessage).toHaveBeenCalledTimes(4);
    expect(upsertLeaderboardMessage).toHaveBeenCalledTimes(2);
  });

  test("logs thrown result sync errors without aborting startup", async () => {
    const store = createStore();
    const writeLine = vi.fn();
    const syncFinishedResults = vi.fn(async () => {
      throw new Error("Football Data timeout\nwith detail");
    });

    await expect(
      startCopanalhasBotRuntime({
        config: { ...config(), footballDataToken: "token-value", resultSyncEnabled: true },
        store,
        matches: WORLD_CUP_2026_SEED.matches,
        startDiscord: vi.fn(async () => ({ destroy: vi.fn(async () => undefined) })),
        startInterval: vi.fn(() => ({ stop: vi.fn() })),
        sendMatchCard: vi.fn(async () => "discord-message-1"),
        sendPredictionReveal: vi.fn(async () => ({
          threadId: "thread-1",
          messageId: "reveal-message-1"
        })),
        upsertStandingsMessage: vi.fn(async (message) => `standings-${message.key}`),
        upsertLeaderboardMessage: vi.fn(async () => "leaderboard-message-1"),
        syncFinishedResults,
        now: () => new Date("2026-06-11T21:15:00.000Z"),
        writeLine
      })
    ).resolves.toEqual(expect.objectContaining({ stop: expect.any(Function) }));

    expect(writeLine).toHaveBeenCalledWith(
      "[2026-06-11T21:15:00.000Z][result-sync] start mode=scheduled range=2026-06-11..2026-06-11 pending=1"
    );
    expect(writeLine).toHaveBeenCalledWith(
      "[2026-06-11T21:15:00.000Z][result-sync] error mode=scheduled range=2026-06-11..2026-06-11 message=Football Data timeout with detail"
    );
    expect(writeLine).toHaveBeenCalledWith(
      "[2026-06-11T21:15:00.000Z][result-sync] range=2026-06-11..2026-06-11 failed reason=unavailable"
    );
  });

  test("operator sync-results bypasses the scheduled first-check delay", async () => {
    const store = createStore();
    let operatorOptions: OperatorCommandOptions | undefined;
    const startDiscord = vi.fn(async (_config, _onMessage, _predictionOptions, readyOptions) => {
      operatorOptions = readyOptions.operatorCommandOptions;
      return { destroy: vi.fn(async () => undefined) };
    });
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
      startInterval: vi.fn(() => ({ stop: vi.fn() })),
      sendMatchCard: vi.fn(async () => "discord-message-1"),
      sendPredictionReveal: vi.fn(async () => ({
        threadId: "thread-1",
        messageId: "reveal-message-1"
      })),
      upsertStandingsMessage,
      upsertLeaderboardMessage,
      syncFinishedResults,
      now: () => new Date("2026-06-11T21:00:00.000Z"),
      writeLine
    });
    upsertStandingsMessage.mockClear();
    upsertLeaderboardMessage.mockClear();
    syncFinishedResults.mockClear();

    await expect(operatorOptions?.syncResultsNow?.()).resolves.toEqual({
      action: "synced",
      dateFrom: "2026-06-11",
      dateTo: "2026-06-11",
      storedResults: ["wc2026-001"],
      skipped: []
    });

    expect(syncFinishedResults).toHaveBeenCalledOnce();
    expect(syncFinishedResults).toHaveBeenCalledWith(
      expect.objectContaining({
        pendingMatchIds: ["wc2026-001"],
        dateFrom: "2026-06-11",
        dateTo: "2026-06-11"
      })
    );
    expect(upsertStandingsMessage).toHaveBeenCalledTimes(2);
    expect(upsertLeaderboardMessage).toHaveBeenCalledOnce();
    expect(writeLine).toHaveBeenCalledWith(
      "[2026-06-11T21:00:00.000Z][result-sync] start mode=forced range=2026-06-11..2026-06-11 pending=1"
    );
    expect(writeLine).toHaveBeenCalledWith(
      "[2026-06-11T21:00:00.000Z][result-sync] range=2026-06-11..2026-06-11 synced stored=1 skipped=0"
    );
  });

  test("edits prediction reveal messages after result sync stores final scores", async () => {
    const results: StoredResult[] = [];
    const revealPosts: StoredPredictionRevealPost[] = [
      {
        matchId: "wc2026-001",
        channelId: "channel-1",
        threadId: "thread-1",
        messageId: "reveal-message-1",
        revealedAt: "2026-06-11T18:30:00.000Z",
        closeAtUtc: "2026-06-11T18:30:00.000Z",
        resultRevealedAt: null
      }
    ];
    const store = {
      ...createStore(),
      listPredictions: vi.fn(() => [
        {
          userId: "user-1",
          matchId: "wc2026-001",
          messageId: "prediction-message-1",
          homeScore: 1,
          awayScore: 0,
          submittedAt: "2026-06-10T12:00:00.000Z",
          updatedAt: null,
          parserVersion: "prediction-modal-v1"
        }
      ]),
      listResults: vi.fn(() => results),
      upsertResult: vi.fn((result: StoredResult) => {
        const index = results.findIndex((stored) => stored.matchId === result.matchId);
        if (index === -1) {
          results.push(result);
        } else {
          results.splice(index, 1, result);
        }
      }),
      listPredictionRevealPosts: vi.fn(() => revealPosts),
      recordPredictionRevealPost: vi.fn((post: StoredPredictionRevealPost) => {
        const index = revealPosts.findIndex(
          (stored) => stored.matchId === post.matchId && stored.channelId === post.channelId
        );
        revealPosts.splice(index, 1, post);
      })
    };
    const editPredictionReveal = vi.fn(async () => undefined);
    const syncFinishedResults = vi.fn(async (options) => {
      await options.upsertResult({
        matchId: "wc2026-001",
        homeScore: 1,
        awayScore: 0,
        recordedAt: "2026-06-11T21:15:00.000Z",
        resultSource: "football-data",
        externalMatchId: "537327",
        fetchedAt: "2026-06-11T21:15:00.000Z"
      });

      return {
        action: "synced" as const,
        storedResults: ["wc2026-001"],
        skipped: []
      };
    });

    await startCopanalhasBotRuntime({
      config: { ...config(), footballDataToken: "token-value", resultSyncEnabled: true },
      store,
      matches: WORLD_CUP_2026_SEED.matches,
      startDiscord: vi.fn(async () => ({ destroy: vi.fn(async () => undefined) })),
      startInterval: vi.fn(() => ({ stop: vi.fn() })),
      sendMatchCard: vi.fn(async () => "discord-message-1"),
      sendPredictionReveal: vi.fn(async () => ({
        threadId: "thread-1",
        messageId: "reveal-message-1"
      })),
      editPredictionReveal,
      upsertStandingsMessage: vi.fn(async (message) => `standings-${message.key}`),
      upsertLeaderboardMessage: vi.fn(async () => "leaderboard-message-1"),
      syncFinishedResults,
      now: () => new Date("2026-06-11T21:15:00.000Z"),
      writeLine: vi.fn()
    });

    expect(editPredictionReveal).toHaveBeenCalledOnce();
    expect(editPredictionReveal).toHaveBeenCalledWith(
      expect.objectContaining({
        threadId: "thread-1",
        messageId: "reveal-message-1",
        content: expect.stringContaining("Resultado")
      })
    );
    expect(editPredictionReveal).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining("#1 México (1) x (0) África do Sul")
      })
    );
    expect(revealPosts[0]?.resultRevealedAt).toBe("2026-06-11T21:15:00.000Z");
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
      autoPostWindowDays: 3,
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
        windowDays: 3,
        posted: [
          "wc2026-001",
          "wc2026-002",
          "wc2026-003",
          "wc2026-004",
          "wc2026-005",
          "wc2026-006",
          "wc2026-007",
          "wc2026-008"
        ],
        skipped: []
      },
      resultSyncEnabled: false,
      lastResultSync: { action: "disabled" }
    });
    expect(operatorOptions?.getOperatorHealth?.()).toMatchObject({
      discord: {
        online: true,
        guildId: "guild-1",
        channelId: "channel-1"
      },
      nextMatchday: {
        date: "2026-06-11",
        matchCount: 2,
        postedCount: 2
      },
      pendingPredictionReveals: [],
      footballDataConfigured: false,
      resultSyncPlan: {
        action: "disabled",
        reason: "disabled"
      },
      standingsPosts: {
        present: 2,
        expected: 2
      },
      leaderboardPost: {
        present: true
      }
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
    autoPostWindowDays: 3,
    timezone: "America/Sao_Paulo",
    matchdayRolloverTime: "06:00",
    footballDataToken: null,
    resultSyncEnabled: false,
    resultSyncFirstCheckMinutes: 135,
    resultSyncRetryMinutes: 30
  };
}

function createStore(): BotRuntimeStore {
  const postedMatchCards: ReturnType<BotRuntimeStore["listPostedMatchCards"]> = [];
  const predictionRevealPosts: ReturnType<BotRuntimeStore["listPredictionRevealPosts"]> = [];
  const matchStartAlerts: ReturnType<BotRuntimeStore["listMatchStartAlerts"]> = [];
  const standingsPosts: ReturnType<BotRuntimeStore["listStandingsPosts"]> = [];
  const leaderboardPosts: ReturnType<BotRuntimeStore["listLeaderboardPosts"]> = [];

  return {
    migrate: vi.fn(),
    upsertMatches: vi.fn(),
    upsertPrediction: vi.fn(),
    upsertResult: vi.fn(),
    listPredictions: vi.fn(() => []),
    listResults: vi.fn(() => []),
    listPostedMatchCards: vi.fn(() => postedMatchCards),
    recordPostedMatchCard: vi.fn((card) => {
      upsertBy(
        postedMatchCards,
        card,
        (stored) => `${stored.matchId}|${stored.channelId}`,
        (next) => `${next.matchId}|${next.channelId}`
      );
    }),
    listPredictionRevealPosts: vi.fn(() => predictionRevealPosts),
    recordPredictionRevealPost: vi.fn((post) => {
      upsertBy(
        predictionRevealPosts,
        post,
        (stored) => `${stored.matchId}|${stored.channelId}`,
        (next) => `${next.matchId}|${next.channelId}`
      );
    }),
    listMatchStartAlerts: vi.fn(() => matchStartAlerts),
    recordMatchStartAlert: vi.fn((alert) => {
      upsertBy(
        matchStartAlerts,
        alert,
        (stored) => `${stored.matchId}|${stored.channelId}`,
        (next) => `${next.matchId}|${next.channelId}`
      );
    }),
    markMatchStartAlertsDeleted: vi.fn((matchIds, deletedAt) => {
      let changes = 0;

      for (const alert of matchStartAlerts) {
        if (matchIds.includes(alert.matchId)) {
          alert.deletedAt = deletedAt;
          changes += 1;
        }
      }

      return changes;
    }),
    clearPostedMatchCardsForDate: vi.fn(() => 0),
    clearPredictionsForMatches: vi.fn(() => 0),
    clearResultsForMatches: vi.fn(() => 0),
    clearPredictionRevealPostsForMatches: vi.fn(() => 0),
    clearMatchStartAlertsForMatches: vi.fn(() => 0),
    listStandingsPosts: vi.fn(() => standingsPosts),
    recordStandingsPost: vi.fn((post) => {
      upsertBy(
        standingsPosts,
        post,
        (stored) => `${stored.postKey}|${stored.guildId}|${stored.channelId}`,
        (next) => `${next.postKey}|${next.guildId}|${next.channelId}`
      );
    }),
    listLeaderboardPosts: vi.fn(() => leaderboardPosts),
    recordLeaderboardPost: vi.fn((post) => {
      upsertBy(
        leaderboardPosts,
        post,
        (stored) => `${stored.guildId}|${stored.channelId}`,
        (next) => `${next.guildId}|${next.channelId}`
      );
    }),
    insertScoringRun: vi.fn()
  };
}

function upsertBy<T>(
  rows: T[],
  next: T,
  storedKey: (row: T) => string,
  nextKey: (row: T) => string
): void {
  const key = nextKey(next);
  const index = rows.findIndex((row) => storedKey(row) === key);

  if (index === -1) {
    rows.push(next);
  } else {
    rows.splice(index, 1, next);
  }
}
