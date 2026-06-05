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
        databasePath: "./tmp/test.sqlite"
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
        databasePath: "./data/copanalhas.sqlite"
      }
    });
  });

  test("reports missing required values without echoing secrets", () => {
    expect(parseCopanalhasConfig({ DISCORD_BOT_TOKEN: "token-value" })).toEqual({
      ok: false,
      errors: ["DISCORD_GUILD_ID is required", "DISCORD_CHANNEL_ID is required"]
    });
  });
});
