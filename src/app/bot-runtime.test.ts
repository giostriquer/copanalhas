import { describe, expect, test, vi } from "vitest";

import { startCopanalhasBotRuntime, type BotRuntimeStore } from "./bot-runtime.js";
import type { CopanalhasConfig } from "../discord/config.js";
import { WORLD_CUP_2026_SEED } from "../worldcup/seed.js";

describe("startCopanalhasBotRuntime", () => {
  test("composes storage, Discord handlers, operator commands, and scheduler", async () => {
    const store = createStore();
    const startDiscord = vi.fn(async () => ({ destroy: vi.fn(async () => undefined) }));
    const startInterval = vi.fn(() => ({ stop: vi.fn() }));
    const sendMatchCard = vi.fn(async () => "discord-message-1");
    const upsertStandingsMessage = vi.fn(async (message) => `standings-${message.key}`);
    const writeLine = vi.fn();

    const runtime = await startCopanalhasBotRuntime({
      config: config(),
      store,
      matches: WORLD_CUP_2026_SEED.matches,
      startDiscord,
      startInterval,
      sendMatchCard,
      upsertStandingsMessage,
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
          updateStandingsDashboard: expect.any(Function)
        }),
        registerCommands: expect.any(Function)
      })
    );
    expect(startInterval).toHaveBeenCalled();
    expect(upsertStandingsMessage).toHaveBeenCalledTimes(2);
    expect(store.recordStandingsPost).toHaveBeenCalledTimes(2);

    await runtime.stop();
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
      upsertStandingsMessage,
      syncFinishedResults,
      now: () => new Date("2026-06-11T12:00:00.000Z"),
      writeLine: vi.fn()
    });
    upsertStandingsMessage.mockClear();

    await intervalCallbacks[1]?.();

    expect(syncFinishedResults).toHaveBeenCalledOnce();
    expect(upsertStandingsMessage).toHaveBeenCalledTimes(2);
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
    listStandingsPosts: vi.fn(() => []),
    recordStandingsPost: vi.fn(),
    insertScoringRun: vi.fn()
  };
}
