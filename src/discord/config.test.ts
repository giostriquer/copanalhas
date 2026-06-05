import { describe, expect, test } from "vitest";

import { parseCopanalhasConfig } from "./config.js";

describe("parseCopanalhasConfig", () => {
  test("accepts the required Discord configuration", () => {
    expect(
      parseCopanalhasConfig({
        DISCORD_BOT_TOKEN: "token-value",
        DISCORD_GUILD_ID: "guild-1",
        DISCORD_CHANNEL_ID: "channel-1",
        COPANALHAS_DATABASE_PATH: "./tmp/test.sqlite"
      })
    ).toEqual({
      ok: true,
      config: {
        discordToken: "token-value",
        guildId: "guild-1",
        channelId: "channel-1",
        databasePath: "./tmp/test.sqlite",
        autoPostEnabled: true,
        autoPostTime: "09:00",
        timezone: "America/Sao_Paulo",
        footballDataToken: null,
        resultSyncEnabled: false
      }
    });
  });

  test("uses the default database path when none is provided", () => {
    expect(
      parseCopanalhasConfig({
        DISCORD_BOT_TOKEN: "token-value",
        DISCORD_GUILD_ID: "guild-1",
        DISCORD_CHANNEL_ID: "channel-1"
      })
    ).toEqual({
      ok: true,
      config: {
        discordToken: "token-value",
        guildId: "guild-1",
        channelId: "channel-1",
        databasePath: "./data/copanalhas.sqlite",
        autoPostEnabled: true,
        autoPostTime: "09:00",
        timezone: "America/Sao_Paulo",
        footballDataToken: null,
        resultSyncEnabled: false
      }
    });
  });

  test("accepts explicit autonomous runtime settings", () => {
    expect(
      parseCopanalhasConfig({
        DISCORD_BOT_TOKEN: "token-value",
        DISCORD_GUILD_ID: "guild-1",
        DISCORD_CHANNEL_ID: "channel-1",
        COPANALHAS_AUTO_POST_ENABLED: "false",
        COPANALHAS_AUTO_POST_TIME: "10:30",
        COPANALHAS_TIMEZONE: "UTC",
        FOOTBALL_DATA_TOKEN: "football-data-token",
        COPANALHAS_RESULT_SYNC_ENABLED: "true"
      })
    ).toEqual({
      ok: true,
      config: expect.objectContaining({
        autoPostEnabled: false,
        autoPostTime: "10:30",
        timezone: "UTC",
        footballDataToken: "football-data-token",
        resultSyncEnabled: true
      })
    });
  });

  test("rejects invalid autonomous runtime settings", () => {
    expect(
      parseCopanalhasConfig({
        DISCORD_BOT_TOKEN: "token-value",
        DISCORD_GUILD_ID: "guild-1",
        DISCORD_CHANNEL_ID: "channel-1",
        COPANALHAS_AUTO_POST_TIME: "25:99"
      })
    ).toEqual({
      ok: false,
      errors: ["COPANALHAS_AUTO_POST_TIME must use HH:mm"]
    });
  });

  test("reports missing required values without echoing secrets", () => {
    expect(parseCopanalhasConfig({ DISCORD_BOT_TOKEN: "token-value" })).toEqual({
      ok: false,
      errors: ["DISCORD_GUILD_ID is required", "DISCORD_CHANNEL_ID is required"]
    });
  });
});
