import { describe, expect, test, vi } from "vitest";

import { Events, type Interaction } from "discord.js";

import { createDiscordClient, handleDiscordClientReady, handleDiscordMessage } from "./ingestion.js";
import type { RegisterCopanalhasCommandsOptions } from "./commands.js";
import type { CopanalhasConfig } from "./config.js";
import type { OperatorCommandOptions } from "./operator-commands.js";
import type { PredictionParseResult } from "../predictions/parser.js";

describe("handleDiscordMessage", () => {
  test("ignores messages outside the configured guild before parsing", () => {
    const parse = vi.fn();

    const result = handleDiscordMessage(message({ guildId: "other-guild" }), {
      guildId: "guild-1",
      channelId: "channel-1",
      parsePrediction: parse
    });

    expect(result).toEqual({ action: "ignored", reason: "wrong-guild" });
    expect(parse).not.toHaveBeenCalled();
  });

  test("ignores messages outside the configured channel before parsing", () => {
    const parse = vi.fn();

    const result = handleDiscordMessage(message({ channelId: "other-channel" }), {
      guildId: "guild-1",
      channelId: "channel-1",
      parsePrediction: parse
    });

    expect(result).toEqual({ action: "ignored", reason: "wrong-channel" });
    expect(parse).not.toHaveBeenCalled();
  });

  test("ignores bot-authored messages before parsing", () => {
    const parse = vi.fn();

    const result = handleDiscordMessage(message({ authorIsBot: true }), {
      guildId: "guild-1",
      channelId: "channel-1",
      parsePrediction: parse
    });

    expect(result).toEqual({ action: "ignored", reason: "bot-author" });
    expect(parse).not.toHaveBeenCalled();
  });

  test("ignores empty content before parsing", () => {
    const parse = vi.fn();

    const result = handleDiscordMessage(message({ content: "" }), {
      guildId: "guild-1",
      channelId: "channel-1",
      parsePrediction: parse
    });

    expect(result).toEqual({ action: "ignored", reason: "empty-content" });
    expect(parse).not.toHaveBeenCalled();
  });

  test("accepts parsed predictions from the configured channel", () => {
    const parse = vi.fn(
      (): PredictionParseResult => ({
      ok: true,
      prediction: {
        matchNumber: 1,
        homeTeamCode: "MEX",
        awayTeamCode: "RSA",
        homeScore: 2,
        awayScore: 1,
        normalizedText: "#1 MEX 2-1 RSA"
      }
    }));

    const result = handleDiscordMessage(message({ content: "#1 MEX 2-1 RSA" }), {
      guildId: "guild-1",
      channelId: "channel-1",
      parsePrediction: parse
    });

    expect(result).toEqual({
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
    expect(parse).toHaveBeenCalledWith("#1 MEX 2-1 RSA");
  });

  test("returns parser rejections without storing raw content", () => {
    const parse = vi.fn(
      (): PredictionParseResult => ({ ok: false, reason: "unsupported-format" })
    );

    const result = handleDiscordMessage(message({ content: "hello" }), {
      guildId: "guild-1",
      channelId: "channel-1",
      parsePrediction: parse
    });

    expect(result).toEqual({
      action: "rejected",
      reason: "unsupported-format",
      messageId: "message-1",
      userId: "user-1"
    });
  });
});

describe("handleDiscordClientReady", () => {
  test("registers slash commands for the configured guild", async () => {
    const registerCommands = vi.fn(
      async (_options: RegisterCopanalhasCommandsOptions) => undefined
    );
    const readyClient = {
      user: {
        tag: "Copanalhas#0001"
      },
      guilds: {
        fetch: vi.fn(async (guildId: string) => ({
          id: guildId,
          commands: {
            set: vi.fn(async () => undefined)
          }
        }))
      }
    };
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    try {
      await handleDiscordClientReady(readyClient, config(), { registerCommands });
    } finally {
      log.mockRestore();
    }

    expect(registerCommands).toHaveBeenCalledWith({
      guildId: "guild-1",
      fetchGuild: expect.any(Function)
    });

    const registrationOptions = registerCommands.mock.calls[0]?.[0];
    await expect(registrationOptions?.fetchGuild("guild-1")).resolves.toEqual(
      expect.objectContaining({ id: "guild-1" })
    );
    expect(readyClient.guilds.fetch).toHaveBeenCalledWith("guild-1");
  });
});

describe("createDiscordClient interactions", () => {
  test("routes chat input commands to the operator handler", async () => {
    const handleOperatorCommand = vi.fn(async () => ({
      action: "replied" as const,
      content: "ok",
      ephemeral: true as const
    }));
    const client = createDiscordClient(config(), vi.fn(), undefined, {
      handleOperatorCommand,
      operatorCommandOptions: operatorOptions()
    });

    client.emit(Events.InteractionCreate, {
      isAutocomplete: () => false,
      isChatInputCommand: () => true
    } as unknown as Interaction);
    await new Promise((resolve) => setImmediate(resolve));

    expect(handleOperatorCommand).toHaveBeenCalledOnce();
    client.destroy();
  });

  test("routes autocomplete interactions to the operator autocomplete handler", async () => {
    const handleOperatorAutocomplete = vi.fn(async () => ({
      action: "responded" as const,
      choices: [{ name: "#1 · México x África do Sul", value: "wc2026-001" }]
    }));
    const client = createDiscordClient(config(), vi.fn(), undefined, {
      handleOperatorAutocomplete,
      operatorCommandOptions: operatorOptions()
    });

    client.emit(Events.InteractionCreate, {
      isChatInputCommand: () => false,
      isAutocomplete: () => true
    } as unknown as Interaction);
    await new Promise((resolve) => setImmediate(resolve));

    expect(handleOperatorAutocomplete).toHaveBeenCalledOnce();
    client.destroy();
  });
});

function message(overrides: Partial<Parameters<typeof handleDiscordMessage>[0]> = {}) {
  return {
    id: "message-1",
    guildId: "guild-1",
    channelId: "channel-1",
    authorId: "user-1",
    authorIsBot: false,
    content: "MEX 2-1 RSA",
    createdAt: new Date("2026-06-10T12:00:00.000Z"),
    editedAt: null,
    ...overrides
  };
}

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
    resultSyncRetryMinutes: 1
  };
}

function operatorOptions(): OperatorCommandOptions {
  return {
    guildId: "guild-1",
    channelId: "channel-1",
    matches: [],
    timeZone: "UTC",
    matchdayRolloverTime: "06:00",
    resultSyncEnabled: false,
    now: () => new Date("2026-06-11T23:00:00.000Z"),
    postDueMatchCards: vi.fn(async () => ({ posted: [], skipped: [] })),
    clearPostedMatchCards: vi.fn(() => 0),
    clearPredictionsForMatches: vi.fn(() => 0),
    clearResultsForMatches: vi.fn(() => 0),
    clearPredictionRevealPostsForMatches: vi.fn(() => 0),
    clearMatchStartAlertsForMatches: vi.fn(() => 0),
    listPredictions: vi.fn(() => []),
    listResults: vi.fn(() => []),
    upsertResult: vi.fn(),
    listStandingsPosts: vi.fn(() => []),
    updateStandingsDashboard: vi.fn(async () => ({ action: "updated" as const, posts: [] })),
    listLeaderboardPosts: vi.fn(() => []),
    updateLeaderboardDashboard: vi.fn(async () => ({
      action: "updated" as const,
      post: { messageId: "leaderboard-message-1", action: "edited" as const }
    })),
    syncResultsNow: vi.fn(async () => ({
      action: "disabled" as const,
      reason: "disabled" as const
    }))
  };
}
