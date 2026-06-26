import { describe, expect, test, vi } from "vitest";
import { Buffer } from "node:buffer";

import { startCopanalhasBotRuntime, type BotRuntimeStore } from "./bot-runtime.js";
import type { MatchCardMessage } from "../discord/components.js";
import type { CopanalhasConfig } from "../discord/config.js";
import type { DiscordIngestionResult } from "../discord/ingestion.js";
import type { OperatorCommandOptions } from "../discord/operator-commands.js";
import type {
  StoredMatchStartAlert,
  StoredPredictionRevealPost,
  StoredResult
} from "../storage/database.js";
import { WORLD_CUP_2026_SEED } from "../worldcup/seed.js";
import { isGroupStageMatch, type WorldCupMatch } from "../worldcup/types.js";

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
    const upsertBracketMessage = vi.fn(async () => "bracket-message-1");
    const renderBracketPng = vi.fn(async () => Buffer.from("png"));
    const upsertThirdPlaceMessage = vi.fn(async () => "third-place-message-1");
    const renderThirdPlacePng = vi.fn(async () => Buffer.from("png"));
    const upsertChaosDashboardMessage = vi.fn(async () => "chaos-message-1");
    const renderChaosDashboardPng = vi.fn(async () => Buffer.from("png"));
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
      renderLeaderboardPng: vi.fn(async () => Buffer.from("png")),
      upsertBracketMessage,
      renderBracketPng,
      upsertThirdPlaceMessage,
      renderThirdPlacePng,
      upsertChaosDashboardMessage,
      renderChaosDashboardPng,
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
          updateLeaderboardDashboard: expect.any(Function),
          updateBracketDashboard: expect.any(Function),
          updateThirdPlaceDashboard: expect.any(Function),
          updateChaosDashboard: expect.any(Function)
        }),
        registerCommands: expect.any(Function)
      })
    );
    expect(startInterval).toHaveBeenCalled();
    expect(upsertStandingsMessage).toHaveBeenCalledTimes(2);
    expect(store.recordStandingsPost).toHaveBeenCalledTimes(2);
    expect(upsertLeaderboardMessage).toHaveBeenCalledOnce();
    expect(store.recordLeaderboardPost).toHaveBeenCalledOnce();
    expect(upsertBracketMessage).toHaveBeenCalledOnce();
    expect(store.recordBracketPost).toHaveBeenCalledOnce();
    expect(upsertThirdPlaceMessage).toHaveBeenCalledOnce();
    expect(store.recordThirdPlacePost).toHaveBeenCalledOnce();
    expect(upsertChaosDashboardMessage).not.toHaveBeenCalled();
    expect(store.recordChaosDashboardPost).not.toHaveBeenCalled();
    expect(writeLine).toHaveBeenCalledWith(
      "[2026-06-11T21:15:00.000Z][dashboard] standings posts=2 posted=2 edited=0 replaced=0 image=0 fallback=2"
    );
    expect(writeLine).toHaveBeenCalledWith(
      "[2026-06-11T21:15:00.000Z][dashboard] leaderboard action=posted message=leaderboard-message-1 render=image"
    );
    expect(writeLine).toHaveBeenCalledWith(
      "[2026-06-11T21:15:00.000Z][dashboard] bracket action=posted message=bracket-message-1 phase=provisional render=image"
    );
    expect(writeLine).toHaveBeenCalledWith(
      "[2026-06-11T21:15:00.000Z][dashboard] thirdPlaces action=posted message=third-place-message-1 status=needs-manual-tiebreaker render=image"
    );
    expect(writeLine).toHaveBeenCalledWith(
      "[2026-06-11T21:15:00.000Z][dashboard] recap posts=0 posted=0 edited=0 replaced=0 skipped=3 incomplete=3 alreadyPosted=0"
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
      "[2026-06-11T21:15:00.000Z][health] dashboards standings=2/2 leaderboard=present bracket=present thirdPlaces=present recaps=0 recapPeriods=none lastLeaderboard=2026-06-11T21:15:00.000Z lastBracket=2026-06-11T21:15:00.000Z lastThirdPlaces=2026-06-11T21:15:00.000Z lastRecap=never"
    );

    await runtime.stop();
  });

  test("resolves knockout participants from stored group results during startup", async () => {
    const store = {
      ...createStore(),
      listResults: vi.fn(() => currentSeedProofStoredResults())
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
      renderLeaderboardPng: vi.fn(async () => Buffer.from("png")),
      upsertBracketMessage: vi.fn(async () => "bracket-message-1"),
      renderBracketPng: vi.fn(async () => Buffer.from("png")),
      now: () => new Date("2026-06-28T15:00:00.000Z"),
      writeLine: vi.fn()
    });

    const storedMatches = vi.mocked(store.upsertMatches).mock.calls.at(-1)?.[0] ?? [];

    expect(matchByNumber(storedMatches, 73)).toMatchObject({
      homeTeam: { code: "RSA", name: "South Africa" },
      awayTeam: { code: "BIH", name: "Bosnia and Herzegovina" }
    });
    expect(matchByNumber(operatorOptions?.matches ?? [], 73)).toMatchObject({
      homeTeam: { code: "RSA", name: "South Africa" },
      awayTeam: { code: "BIH", name: "Bosnia and Herzegovina" }
    });
  });

  test("reverts runtime knockout participants when stored results are cleared", async () => {
    let results = currentSeedProofStoredResults();
    const store = {
      ...createStore(),
      listResults: vi.fn(() => results),
      clearResultsForMatches: vi.fn((matchIds: readonly string[]) => {
        const before = results.length;
        results = results.filter((result) => !matchIds.includes(result.matchId));

        return before - results.length;
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
      renderLeaderboardPng: vi.fn(async () => Buffer.from("png")),
      upsertBracketMessage: vi.fn(async () => "bracket-message-1"),
      renderBracketPng: vi.fn(async () => Buffer.from("png")),
      now: () => new Date("2026-06-28T15:00:00.000Z"),
      writeLine: vi.fn()
    });

    expect(matchByNumber(operatorOptions?.matches ?? [], 73)).toMatchObject({
      homeTeam: { code: "RSA" },
      awayTeam: { code: "BIH" }
    });

    operatorOptions?.clearResultsForMatches(results.map((result) => result.matchId));

    expect(matchByNumber(operatorOptions?.matches ?? [], 73)).toMatchObject({
      homeTeam: { code: "2A", name: "2º Grupo A" },
      awayTeam: { code: "2B", name: "2º Grupo B" }
    });
  });

  test("posts completed recap periods during startup backfill", async () => {
    const store = {
      ...createStore(),
      listPredictions: vi.fn(() => [
        {
          userId: "user-a",
          matchId: "wc2026-001",
          messageId: "prediction-message-1",
          homeScore: 1,
          awayScore: 0,
          submittedAt: "2026-06-10T12:00:00.000Z",
          updatedAt: null,
          parserVersion: "prediction-modal-v1"
        }
      ]),
      listResults: vi.fn(() =>
        WORLD_CUP_2026_SEED.matches
          .filter((match) => match.matchNumber <= 24)
          .map((match) => storedResult(match.id))
      )
    };
    const upsertChaosDashboardMessage = vi.fn(async (message, existingMessageId) => {
      expect(existingMessageId).toBeNull();
      expect(message.content).toContain("Fase de grupos - semana 1");
      return "recap-week-1";
    });
    const writeLine = vi.fn();

    await startCopanalhasBotRuntime({
      config: config(),
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
      renderLeaderboardPng: vi.fn(async () => Buffer.from("png")),
      upsertBracketMessage: vi.fn(async () => "bracket-message-1"),
      renderBracketPng: vi.fn(async () => Buffer.from("png")),
      upsertChaosDashboardMessage,
      renderChaosDashboardPng: vi.fn(async () => Buffer.from("png")),
      now: () => new Date("2026-06-24T15:30:00.000Z"),
      writeLine
    });

    expect(upsertChaosDashboardMessage).toHaveBeenCalledOnce();
    expect(store.recordChaosDashboardPost).toHaveBeenCalledWith(
      expect.objectContaining({
        periodKey: "group-week-1",
        messageId: "recap-week-1"
      })
    );
    expect(writeLine).toHaveBeenCalledWith(
      "[2026-06-24T15:30:00.000Z][dashboard] recap posts=1 posted=1 edited=0 replaced=0 skipped=2 incomplete=2 alreadyPosted=0 periods=group-week-1 copyApplied=0 copyFallback=0 copyDisabled=1"
    );
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
      renderLeaderboardPng: vi.fn(async () => Buffer.from("png")),
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

  test("posts fixed round-of-32 cards with resolved teams during startup catch-up", async () => {
    const sentMessages: MatchCardMessage[] = [];
    const store = {
      ...createStore(),
      listResults: vi.fn(() => currentSeedProofStoredResultsForGroups(["A", "B"]))
    };

    await startCopanalhasBotRuntime({
      config: config(),
      store,
      matches: WORLD_CUP_2026_SEED.matches,
      startDiscord: vi.fn(async () => ({ destroy: vi.fn(async () => undefined) })),
      startInterval: vi.fn(() => ({ stop: vi.fn() })),
      sendMatchCard: vi.fn(async (message) => {
        sentMessages.push(message);
        return `discord-message-${sentMessages.length}`;
      }),
      sendPredictionReveal: vi.fn(async () => ({
        threadId: "thread-1",
        messageId: "reveal-message-1"
      })),
      upsertStandingsMessage: vi.fn(async (message) => `standings-${message.key}`),
      upsertLeaderboardMessage: vi.fn(async () => "leaderboard-message-1"),
      renderLeaderboardPng: vi.fn(async () => Buffer.from("png")),
      now: () => new Date("2026-06-26T12:15:00.000Z"),
      writeLine: vi.fn()
    });

    const roundOf32Field = sentMessages
      .flatMap((message) => message.embeds?.[0]?.toJSON().fields ?? [])
      .find((field) => field.name === "#73 · Rodada de 32");

    expect(roundOf32Field?.value).toContain("África do Sul x Bósnia e Herzegovina");
    expect(roundOf32Field?.value).not.toContain("2º Grupo A");
    expect(roundOf32Field?.value).not.toContain("2º Grupo B");
    expect(store.recordPostedMatchCard).toHaveBeenCalledWith(
      expect.objectContaining({
        matchId: "wc2026-073",
        postedForDate: "2026-06-28"
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
      renderLeaderboardPng: vi.fn(async () => Buffer.from("png")),
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
      renderLeaderboardPng: vi.fn(async () => Buffer.from("png")),
      now: () => new Date("2026-06-11T18:55:20.000Z"),
      writeLine
    });

    expect(sendMatchStartAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining("PARTIDA COMEÇANDO"),
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
      "[2026-06-11T18:55:20.000Z][match-start] posted=1 deleted=0 matches=wc2026-001 messages=none"
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
      renderLeaderboardPng: vi.fn(async () => Buffer.from("png")),
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

  test("does not refresh the leaderboard after accepted predictions reach runtime handlers", async () => {
    const store = createStore();
    let onMessageResult: ((result: DiscordIngestionResult) => void | Promise<void>) | undefined;
    const startDiscord = vi.fn(async (_config, onMessage, interactionOptions) => {
      onMessageResult = onMessage;
      expect(interactionOptions).not.toHaveProperty("refreshLeaderboardAfterPrediction");
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
      renderLeaderboardPng: vi.fn(async () => Buffer.from("png")),
      now: () => new Date("2026-06-11T12:00:00.000Z"),
      writeLine: vi.fn()
    });

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
    expect(upsertLeaderboardMessage).not.toHaveBeenCalled();
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
    const upsertBracketMessage = vi.fn(async () => "bracket-message-1");
    const renderBracketPng = vi.fn(async () => Buffer.from("png"));
    const upsertThirdPlaceMessage = vi.fn(async () => "third-place-message-1");
    const renderThirdPlacePng = vi.fn(async () => Buffer.from("png"));
    const upsertChaosDashboardMessage = vi.fn(async () => "chaos-message-1");
    const renderChaosDashboardPng = vi.fn(async () => Buffer.from("png"));
    let now = new Date("2026-06-11T21:00:00.000Z");
    const syncFinishedResults = vi.fn(async () => ({
      action: "synced" as const,
      storedResults: ["wc2026-001"],
      skipped: []
    }));

    await startCopanalhasBotRuntime({
      config: {
        ...config(),
        footballDataToken: "token-value",
        resultSyncEnabled: true,
        resultSyncFirstCheckMinutes: 110,
        resultSyncRetryMinutes: 1
      },
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
      renderLeaderboardPng: vi.fn(async () => Buffer.from("png")),
      upsertBracketMessage,
      renderBracketPng,
      upsertThirdPlaceMessage,
      renderThirdPlacePng,
      upsertChaosDashboardMessage,
      renderChaosDashboardPng,
      syncFinishedResults,
      now: () => now,
      writeLine: vi.fn()
    });
    expect(startInterval).toHaveBeenNthCalledWith(3, expect.any(Function), 60 * 1000);
    upsertStandingsMessage.mockClear();
    upsertLeaderboardMessage.mockClear();
    upsertBracketMessage.mockClear();
    upsertThirdPlaceMessage.mockClear();
    upsertChaosDashboardMessage.mockClear();
    syncFinishedResults.mockClear();

    now = new Date("2026-06-11T21:15:00.000Z");
    await intervalCallbacks[2]?.();

    expect(syncFinishedResults).toHaveBeenCalledOnce();
    expect(upsertStandingsMessage).toHaveBeenCalledTimes(2);
    expect(upsertLeaderboardMessage).toHaveBeenCalledOnce();
    expect(upsertBracketMessage).toHaveBeenCalledOnce();
    expect(upsertThirdPlaceMessage).toHaveBeenCalledOnce();
    expect(upsertChaosDashboardMessage).not.toHaveBeenCalled();
  });

  test("keeps cached leaderboard display names when a later refresh falls back to ids", async () => {
    const userId = "1182735062773534741";
    const store = {
      ...createStore(),
      listPredictions: vi.fn(() => [
        {
          userId,
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
    const intervalCallbacks: Array<() => void | Promise<void>> = [];
    const startInterval = vi.fn((callback) => {
      intervalCallbacks.push(callback);
      return { stop: vi.fn() };
    });
    const renderedLeaderboardSvgs: string[] = [];
    let displayNameCallCount = 0;
    const resolveUserDisplayNames = vi.fn(async () => {
      displayNameCallCount += 1;

      return new Map([
        [userId, displayNameCallCount === 1 ? "Giova" : userId]
      ]);
    });
    const syncFinishedResults = vi.fn(async () => ({
      action: "synced" as const,
      storedResults: ["wc2026-001"],
      skipped: []
    }));
    let now = new Date("2026-06-11T20:00:00.000Z");

    await startCopanalhasBotRuntime({
      config: {
        ...config(),
        footballDataToken: "token-value",
        resultSyncEnabled: true,
        resultSyncFirstCheckMinutes: 110,
        resultSyncRetryMinutes: 1
      },
      store,
      matches: WORLD_CUP_2026_SEED.matches,
      startDiscord: vi.fn(async () => ({ destroy: vi.fn(async () => undefined) })),
      startInterval,
      sendMatchCard: vi.fn(async () => "discord-message-1"),
      sendPredictionReveal: vi.fn(async () => ({
        threadId: "thread-1",
        messageId: "reveal-message-1"
      })),
      upsertStandingsMessage: vi.fn(async (message) => `standings-${message.key}`),
      upsertLeaderboardMessage: vi.fn(async () => "leaderboard-message-1"),
      renderLeaderboardPng: vi.fn(async (svg) => {
        renderedLeaderboardSvgs.push(svg);
        return Buffer.from("png");
      }),
      syncFinishedResults,
      resolveUserDisplayNames,
      now: () => now,
      writeLine: vi.fn()
    });

    expect(renderedLeaderboardSvgs.at(-1)).toContain(">Giova</text>");

    now = new Date("2026-06-11T21:15:00.000Z");
    await intervalCallbacks[2]?.();

    expect(resolveUserDisplayNames).toHaveBeenCalledTimes(2);
    expect(renderedLeaderboardSvgs.at(-1)).toContain(">Giova</text>");
    expect(renderedLeaderboardSvgs.at(-1)).not.toContain(`>${userId}</text>`);
  });

  test("keeps cached leaderboard display names when a later refresh cannot resolve names", async () => {
    const userId = "1182735062773534741";
    const store = {
      ...createStore(),
      listPredictions: vi.fn(() => [
        {
          userId,
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
    const intervalCallbacks: Array<() => void | Promise<void>> = [];
    const startInterval = vi.fn((callback) => {
      intervalCallbacks.push(callback);
      return { stop: vi.fn() };
    });
    const renderedLeaderboardSvgs: string[] = [];
    let displayNameCallCount = 0;
    const resolveUserDisplayNames = vi.fn(async () => {
      displayNameCallCount += 1;

      if (displayNameCallCount > 1) {
        throw new Error("Discord member lookup failed");
      }

      return new Map([[userId, "Giova"]]);
    });
    const syncFinishedResults = vi.fn(async () => ({
      action: "synced" as const,
      storedResults: ["wc2026-001"],
      skipped: []
    }));
    let now = new Date("2026-06-11T20:00:00.000Z");

    await startCopanalhasBotRuntime({
      config: {
        ...config(),
        footballDataToken: "token-value",
        resultSyncEnabled: true,
        resultSyncFirstCheckMinutes: 110,
        resultSyncRetryMinutes: 1
      },
      store,
      matches: WORLD_CUP_2026_SEED.matches,
      startDiscord: vi.fn(async () => ({ destroy: vi.fn(async () => undefined) })),
      startInterval,
      sendMatchCard: vi.fn(async () => "discord-message-1"),
      sendPredictionReveal: vi.fn(async () => ({
        threadId: "thread-1",
        messageId: "reveal-message-1"
      })),
      upsertStandingsMessage: vi.fn(async (message) => `standings-${message.key}`),
      upsertLeaderboardMessage: vi.fn(async () => "leaderboard-message-1"),
      renderLeaderboardPng: vi.fn(async (svg) => {
        renderedLeaderboardSvgs.push(svg);
        return Buffer.from("png");
      }),
      syncFinishedResults,
      resolveUserDisplayNames,
      now: () => now,
      writeLine: vi.fn()
    });

    now = new Date("2026-06-11T21:15:00.000Z");
    await intervalCallbacks[2]?.();

    expect(resolveUserDisplayNames).toHaveBeenCalledTimes(2);
    expect(renderedLeaderboardSvgs.at(-1)).toContain(">Giova</text>");
    expect(renderedLeaderboardSvgs.at(-1)).not.toContain(`>${userId}</text>`);
  });

  test("isolates bracket refresh failures from standings and leaderboard refreshes", async () => {
    const store = createStore();
    const intervalCallbacks: Array<() => void | Promise<void>> = [];
    const startInterval = vi.fn((callback) => {
      intervalCallbacks.push(callback);
      return { stop: vi.fn() };
    });
    const upsertStandingsMessage = vi.fn(async (message) => `standings-${message.key}`);
    const upsertLeaderboardMessage = vi.fn(async () => "leaderboard-message-1");
    const upsertBracketMessage = vi.fn(async () => {
      throw new Error("Discord upload failed");
    });
    const upsertThirdPlaceMessage = vi.fn(async () => "third-place-message-1");
    const writeLine = vi.fn();
    let now = new Date("2026-06-11T21:00:00.000Z");
    const syncFinishedResults = vi.fn(async () => ({
      action: "synced" as const,
      storedResults: ["wc2026-001"],
      skipped: []
    }));

    await startCopanalhasBotRuntime({
      config: {
        ...config(),
        footballDataToken: "token-value",
        resultSyncEnabled: true,
        resultSyncFirstCheckMinutes: 110,
        resultSyncRetryMinutes: 1
      },
      store,
      matches: WORLD_CUP_2026_SEED.matches,
      startDiscord: vi.fn(async () => ({ destroy: vi.fn(async () => undefined) })),
      startInterval,
      sendMatchCard: vi.fn(async () => "discord-message-1"),
      sendPredictionReveal: vi.fn(async () => ({
        threadId: "thread-1",
        messageId: "reveal-message-1"
      })),
      upsertStandingsMessage,
      upsertLeaderboardMessage,
      renderLeaderboardPng: vi.fn(async () => Buffer.from("png")),
      upsertBracketMessage,
      renderBracketPng: vi.fn(async () => Buffer.from("png")),
      upsertThirdPlaceMessage,
      renderThirdPlacePng: vi.fn(async () => Buffer.from("png")),
      syncFinishedResults,
      now: () => now,
      writeLine
    });
    upsertStandingsMessage.mockClear();
    upsertLeaderboardMessage.mockClear();
    upsertBracketMessage.mockClear();
    upsertThirdPlaceMessage.mockClear();
    writeLine.mockClear();
    syncFinishedResults.mockClear();

    now = new Date("2026-06-11T21:15:00.000Z");
    await intervalCallbacks[2]?.();

    expect(syncFinishedResults).toHaveBeenCalledOnce();
    expect(upsertStandingsMessage).toHaveBeenCalledTimes(2);
    expect(upsertLeaderboardMessage).toHaveBeenCalledOnce();
    expect(upsertBracketMessage).toHaveBeenCalledOnce();
    expect(upsertThirdPlaceMessage).toHaveBeenCalledOnce();
    expect(writeLine).toHaveBeenCalledWith(
      "[2026-06-11T21:15:00.000Z][runtime] scope=bracket-dashboard message=Discord upload failed"
    );
  });

  test("does not repeat unchanged result sync not-due logs every minute", async () => {
    const intervalCallbacks: Array<() => void | Promise<void>> = [];
    const startInterval = vi.fn((callback) => {
      intervalCallbacks.push(callback);
      return { stop: vi.fn() };
    });
    const writeLine = vi.fn();
    let now = new Date("2026-06-11T20:40:00.000Z");

    await startCopanalhasBotRuntime({
      config: {
        ...config(),
        footballDataToken: "token-value",
        resultSyncEnabled: true,
        resultSyncFirstCheckMinutes: 110,
        resultSyncRetryMinutes: 1
      },
      store: createStore(),
      matches: WORLD_CUP_2026_SEED.matches,
      startDiscord: vi.fn(async () => ({ destroy: vi.fn(async () => undefined) })),
      startInterval,
      sendMatchCard: vi.fn(async () => "discord-message-1"),
      sendPredictionReveal: vi.fn(async () => ({
        threadId: "thread-1",
        messageId: "reveal-message-1"
      })),
      upsertStandingsMessage: vi.fn(async (message) => `standings-${message.key}`),
      upsertLeaderboardMessage: vi.fn(async () => "leaderboard-message-1"),
      renderLeaderboardPng: vi.fn(async () => Buffer.from("png")),
      now: () => now,
      writeLine
    });
    writeLine.mockClear();

    now = new Date("2026-06-11T20:41:00.000Z");
    await intervalCallbacks[2]?.();

    expect(writeLine).not.toHaveBeenCalledWith(
      "[2026-06-11T20:41:00.000Z][result-sync] not-due pending=72 next=2026-06-11T20:50:00.000Z"
    );
  });

  test("keeps retrying a simultaneous match skipped after another result stores", async () => {
    const results: StoredResult[] = [];
    const store = {
      ...createStore(),
      listResults: vi.fn(() => results),
      upsertResult: vi.fn((result: StoredResult) => {
        const index = results.findIndex((stored) => stored.matchId === result.matchId);

        if (index === -1) {
          results.push(result);
        } else {
          results.splice(index, 1, result);
        }
      })
    };
    const intervalCallbacks: Array<() => void | Promise<void>> = [];
    const startInterval = vi.fn((callback) => {
      intervalCallbacks.push(callback);
      return { stop: vi.fn() };
    });
    const writeLine = vi.fn();
    let now = new Date("2026-06-11T20:49:00.000Z");
    const matches = WORLD_CUP_2026_SEED.matches.map((match) =>
      match.id === "wc2026-001" || match.id === "wc2026-002"
        ? {
            ...match,
            localDate: "2026-06-11",
            kickoffTimeLocal: "16:00",
            kickoffAtUtc: "2026-06-11T19:00:00.000Z"
          }
        : match
    );
    let syncAttempt = 0;
    const syncFinishedResults = vi.fn(async (syncOptions) => {
      syncAttempt += 1;

      if (syncAttempt === 1) {
        await syncOptions.upsertResult({
          matchId: "wc2026-001",
          homeScore: 1,
          awayScore: 0,
          recordedAt: now.toISOString(),
          resultSource: "football-data",
          externalMatchId: "537327",
          fetchedAt: now.toISOString()
        });

        return {
          action: "synced" as const,
          storedResults: ["wc2026-001"],
          skipped: ["wc2026-002"]
        };
      }

      return {
        action: "synced" as const,
        storedResults: [],
        skipped: ["wc2026-002"]
      };
    });

    await startCopanalhasBotRuntime({
      config: {
        ...config(),
        footballDataToken: "token-value",
        resultSyncEnabled: true,
        resultSyncFirstCheckMinutes: 110,
        resultSyncRetryMinutes: 1
      },
      store,
      matches,
      startDiscord: vi.fn(async () => ({ destroy: vi.fn(async () => undefined) })),
      startInterval,
      sendMatchCard: vi.fn(async () => "discord-message-1"),
      sendPredictionReveal: vi.fn(async () => ({
        threadId: "thread-1",
        messageId: "reveal-message-1"
      })),
      upsertStandingsMessage: vi.fn(async (message) => `standings-${message.key}`),
      upsertLeaderboardMessage: vi.fn(async () => "leaderboard-message-1"),
      renderLeaderboardPng: vi.fn(async () => Buffer.from("png")),
      syncFinishedResults,
      now: () => now,
      writeLine
    });

    now = new Date("2026-06-11T20:50:00.000Z");
    await intervalCallbacks[2]?.();
    expect(syncFinishedResults).toHaveBeenLastCalledWith(
      expect.objectContaining({
        pendingMatchIds: ["wc2026-001", "wc2026-002"]
      })
    );
    expect(writeLine).toHaveBeenCalledWith(
      "[2026-06-11T20:50:00.000Z][result-sync] next pending=1 next=2026-06-11T20:51:00.000Z"
    );

    now = new Date("2026-06-11T20:51:00.000Z");
    await intervalCallbacks[2]?.();
    expect(syncFinishedResults).toHaveBeenLastCalledWith(
      expect.objectContaining({
        pendingMatchIds: ["wc2026-002"]
      })
    );
  });

  test("syncs recent results during startup catch-up when configured", async () => {
    const store = createStore();
    const startDiscord = vi.fn(async () => ({ destroy: vi.fn(async () => undefined) }));
    const startInterval = vi.fn(() => ({ stop: vi.fn() }));
    const upsertStandingsMessage = vi.fn(async (message) => `standings-${message.key}`);
    const upsertLeaderboardMessage = vi.fn(async () => "leaderboard-message-1");
    const upsertBracketMessage = vi.fn(async () => "bracket-message-1");
    const renderBracketPng = vi.fn(async () => Buffer.from("png"));
    const upsertThirdPlaceMessage = vi.fn(async () => "third-place-message-1");
    const renderThirdPlacePng = vi.fn(async () => Buffer.from("png"));
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
      renderLeaderboardPng: vi.fn(async () => Buffer.from("png")),
      upsertBracketMessage,
      renderBracketPng,
      upsertThirdPlaceMessage,
      renderThirdPlacePng,
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
      "[2026-06-11T21:15:00.000Z][dashboard] standings posts=2 posted=2 edited=0 replaced=0 image=0 fallback=2"
    );
    expect(writeLine).toHaveBeenCalledWith(
      "[2026-06-11T21:15:00.000Z][dashboard] leaderboard action=posted message=leaderboard-message-1 render=image"
    );
    expect(writeLine).toHaveBeenCalledWith(
      "[2026-06-11T21:15:00.000Z][dashboard] bracket action=posted message=bracket-message-1 phase=provisional render=image"
    );
    expect(writeLine).toHaveBeenCalledWith(
      "[2026-06-11T21:15:00.000Z][dashboard] thirdPlaces action=posted message=third-place-message-1 status=needs-manual-tiebreaker render=image"
    );
    expect(upsertStandingsMessage).toHaveBeenCalledTimes(4);
    expect(upsertLeaderboardMessage).toHaveBeenCalledTimes(2);
    expect(upsertBracketMessage).toHaveBeenCalledTimes(2);
    expect(upsertThirdPlaceMessage).toHaveBeenCalledTimes(2);
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
        renderLeaderboardPng: vi.fn(async () => Buffer.from("png")),
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
    const upsertBracketMessage = vi.fn(async () => "bracket-message-1");
    const renderBracketPng = vi.fn(async () => Buffer.from("png"));
    const upsertThirdPlaceMessage = vi.fn(async () => "third-place-message-1");
    const renderThirdPlacePng = vi.fn(async () => Buffer.from("png"));
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
      renderLeaderboardPng: vi.fn(async () => Buffer.from("png")),
      upsertBracketMessage,
      renderBracketPng,
      upsertThirdPlaceMessage,
      renderThirdPlacePng,
      syncFinishedResults,
      now: () => new Date("2026-06-11T21:00:00.000Z"),
      writeLine
    });
    upsertStandingsMessage.mockClear();
    upsertLeaderboardMessage.mockClear();
    upsertBracketMessage.mockClear();
    upsertThirdPlaceMessage.mockClear();
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
    expect(upsertBracketMessage).toHaveBeenCalledOnce();
    expect(upsertThirdPlaceMessage).toHaveBeenCalledOnce();
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
      renderLeaderboardPng: vi.fn(async () => Buffer.from("png")),
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
      renderLeaderboardPng: vi.fn(async () => Buffer.from("png")),
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
      },
      bracketPost: {
        present: false
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
      renderLeaderboardPng: vi.fn(async () => Buffer.from("png")),
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
    resultSyncFirstCheckMinutes: 110,
    resultSyncRetryMinutes: 1,
    recapCodexEnabled: false,
    recapCodexCommand: "codex",
    recapCodexOutputDir: "./data/recap-copy",
    recapCodexTimeoutMs: 120000
  };
}

const currentSeedRankOrderByGroup = {
  A: ["MEX", "RSA", "KOR", "CZE"],
  B: ["CAN", "BIH", "QAT", "SUI"],
  C: ["BRA", "MAR", "HAI", "SCO"],
  D: ["USA", "PAR", "AUS", "TUR"],
  E: ["GER", "CUW", "CIV", "ECU"],
  F: ["NED", "JPN", "SWE", "TUN"],
  G: ["BEL", "EGY", "IRN", "NZL"],
  H: ["ESP", "CPV", "KSA", "URU"],
  I: ["FRA", "SEN", "IRQ", "NOR"],
  J: ["ARG", "ALG", "AUT", "JOR"],
  K: ["POR", "COD", "UZB", "COL"],
  L: ["ENG", "CRO", "GHA", "PAN"]
} as const satisfies Record<string, readonly string[]>;
const currentSeedRankOrders: Readonly<Record<string, readonly string[]>> =
  currentSeedRankOrderByGroup;

function currentSeedProofStoredResults(): StoredResult[] {
  return currentSeedProofStoredResultsForGroups("ABCDEFGHIJKL".split(""));
}

function currentSeedProofStoredResultsForGroups(groups: readonly string[]): StoredResult[] {
  return WORLD_CUP_2026_SEED.matches.filter(isGroupStageMatch).map((match) => {
    if (!groups.includes(match.group)) {
      return null;
    }

    const homeRank = currentSeedRank(match.group, match.homeTeam.code);
    const awayRank = currentSeedRank(match.group, match.awayTeam.code);
    const winnerIsHome = homeRank < awayRank;
    const winnerRank = Math.min(homeRank, awayRank);
    const loserRank = Math.max(homeRank, awayRank);
    const winnerGoals = winnerRank === 3 && loserRank === 4 && match.group >= "E" ? 5 : 3;

    return storedResult(
      match.id,
      winnerIsHome ? winnerGoals : 0,
      winnerIsHome ? 0 : winnerGoals
    );
  }).filter((candidate): candidate is StoredResult => candidate !== null);
}

function currentSeedRank(group: string, teamCode: string): number {
  const order = currentSeedRankOrders[group];
  const index = order?.indexOf(teamCode) ?? -1;

  if (index < 0) {
    throw new Error(`Missing proof-test rank for Group ${group} team ${teamCode}.`);
  }

  return index + 1;
}

function createStore(): BotRuntimeStore {
  const postedMatchCards: ReturnType<BotRuntimeStore["listPostedMatchCards"]> = [];
  const predictionRevealPosts: ReturnType<BotRuntimeStore["listPredictionRevealPosts"]> = [];
  const matchStartAlerts: ReturnType<BotRuntimeStore["listMatchStartAlerts"]> = [];
  const standingsPosts: ReturnType<BotRuntimeStore["listStandingsPosts"]> = [];
  const leaderboardPosts: ReturnType<BotRuntimeStore["listLeaderboardPosts"]> = [];
  const bracketPosts: ReturnType<BotRuntimeStore["listBracketPosts"]> = [];
  const thirdPlacePosts: ReturnType<BotRuntimeStore["listThirdPlacePosts"]> = [];
  const chaosDashboardPosts: ReturnType<BotRuntimeStore["listChaosDashboardPosts"]> = [];
  const chaosWeeklySnapshotRows: ReturnType<BotRuntimeStore["listChaosWeeklySnapshotRows"]> = [];

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
    listBracketPosts: vi.fn(() => bracketPosts),
    recordBracketPost: vi.fn((post) => {
      upsertBy(
        bracketPosts,
        post,
        (stored) => `${stored.guildId}|${stored.channelId}`,
        (next) => `${next.guildId}|${next.channelId}`
      );
    }),
    listThirdPlacePosts: vi.fn(() => thirdPlacePosts),
    recordThirdPlacePost: vi.fn((post) => {
      upsertBy(
        thirdPlacePosts,
        post,
        (stored) => `${stored.guildId}|${stored.channelId}`,
        (next) => `${next.guildId}|${next.channelId}`
      );
    }),
    listChaosDashboardPosts: vi.fn(() => chaosDashboardPosts),
    recordChaosDashboardPost: vi.fn((post) => {
      upsertBy(
        chaosDashboardPosts,
        post,
        (stored) => `${stored.periodKey}|${stored.guildId}|${stored.channelId}`,
        (next) => `${next.periodKey}|${next.guildId}|${next.channelId}`
      );
    }),
    listChaosWeeklySnapshotRows: vi.fn(() => chaosWeeklySnapshotRows),
    recordChaosWeeklySnapshotRows: vi.fn((weekStart, guildId, channelId, rows, createdAt) => {
      for (const row of rows) {
        upsertBy(
          chaosWeeklySnapshotRows,
          {
            ...row,
            weekStart,
            guildId,
            channelId,
            createdAt
          },
          (stored) => `${stored.weekStart}|${stored.guildId}|${stored.channelId}|${stored.userId}`,
          (next) => `${next.weekStart}|${next.guildId}|${next.channelId}|${next.userId}`
        );
      }
    }),
    insertScoringRun: vi.fn()
  };
}

function storedResult(matchId: string, homeScore = 1, awayScore = 0): StoredResult {
  return {
    matchId,
    homeScore,
    awayScore,
    recordedAt: "2026-06-24T15:00:00.000Z",
    resultSource: "manual",
    externalMatchId: null,
    fetchedAt: null
  };
}

function matchByNumber(matches: readonly WorldCupMatch[], matchNumber: number): WorldCupMatch {
  const match = matches.find((candidate) => candidate.matchNumber === matchNumber);

  if (!match) {
    throw new Error(`Missing match #${matchNumber}`);
  }

  return match;
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
