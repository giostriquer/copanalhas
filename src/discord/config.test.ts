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
        autoPostWindowDays: 3,
        timezone: "America/Sao_Paulo",
        matchdayRolloverTime: "06:00",
        footballDataToken: null,
        resultSyncEnabled: false,
        resultSyncFirstCheckMinutes: 135,
        resultSyncRetryMinutes: 30,
        matchStartRoleId: null,
        matchStartAlertDeleteAfterMinutes: 180,
        matchStartAlertGraceMinutes: 5
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
        autoPostWindowDays: 3,
        timezone: "America/Sao_Paulo",
        matchdayRolloverTime: "06:00",
        footballDataToken: null,
        resultSyncEnabled: false,
        resultSyncFirstCheckMinutes: 135,
        resultSyncRetryMinutes: 30,
        matchStartRoleId: null,
        matchStartAlertDeleteAfterMinutes: 180,
        matchStartAlertGraceMinutes: 5
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
        COPANALHAS_AUTO_POST_WINDOW_DAYS: "4",
        COPANALHAS_TIMEZONE: "UTC",
        COPANALHAS_MATCHDAY_ROLLOVER_TIME: "05:30",
        FOOTBALL_DATA_TOKEN: "football-data-token",
        COPANALHAS_RESULT_SYNC_ENABLED: "true",
        COPANALHAS_RESULT_SYNC_FIRST_CHECK_MINUTES: "150",
        COPANALHAS_RESULT_SYNC_RETRY_MINUTES: "45",
        COPANALHAS_MATCH_START_ROLE_ID: "role-canalhas",
        COPANALHAS_MATCH_START_DELETE_AFTER_MINUTES: "210",
        COPANALHAS_MATCH_START_GRACE_MINUTES: "7"
      })
    ).toEqual({
      ok: true,
      config: expect.objectContaining({
        autoPostEnabled: false,
        autoPostTime: "10:30",
        autoPostWindowDays: 4,
        timezone: "UTC",
        matchdayRolloverTime: "05:30",
        footballDataToken: "football-data-token",
        resultSyncEnabled: true,
        resultSyncFirstCheckMinutes: 150,
        resultSyncRetryMinutes: 45,
        matchStartRoleId: "role-canalhas",
        matchStartAlertDeleteAfterMinutes: 210,
        matchStartAlertGraceMinutes: 7
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

  test("rejects invalid auto-post window days", () => {
    expect(
      parseCopanalhasConfig({
        DISCORD_BOT_TOKEN: "token-value",
        DISCORD_GUILD_ID: "guild-1",
        DISCORD_CHANNEL_ID: "channel-1",
        COPANALHAS_AUTO_POST_WINDOW_DAYS: "0"
      })
    ).toEqual({
      ok: false,
      errors: ["COPANALHAS_AUTO_POST_WINDOW_DAYS must be a positive integer"]
    });
  });

  test("rejects invalid matchday rollover time", () => {
    expect(
      parseCopanalhasConfig({
        DISCORD_BOT_TOKEN: "token-value",
        DISCORD_GUILD_ID: "guild-1",
        DISCORD_CHANNEL_ID: "channel-1",
        COPANALHAS_MATCHDAY_ROLLOVER_TIME: "6"
      })
    ).toEqual({
      ok: false,
      errors: ["COPANALHAS_MATCHDAY_ROLLOVER_TIME must use HH:mm"]
    });
  });

  test("rejects invalid result sync timing", () => {
    expect(
      parseCopanalhasConfig({
        DISCORD_BOT_TOKEN: "token-value",
        DISCORD_GUILD_ID: "guild-1",
        DISCORD_CHANNEL_ID: "channel-1",
        COPANALHAS_RESULT_SYNC_FIRST_CHECK_MINUTES: "0",
        COPANALHAS_RESULT_SYNC_RETRY_MINUTES: "later"
      })
    ).toEqual({
      ok: false,
      errors: [
        "COPANALHAS_RESULT_SYNC_FIRST_CHECK_MINUTES must be a positive integer",
        "COPANALHAS_RESULT_SYNC_RETRY_MINUTES must be a positive integer"
      ]
    });
  });

  test("rejects invalid match start alert timing", () => {
    expect(
      parseCopanalhasConfig({
        DISCORD_BOT_TOKEN: "token-value",
        DISCORD_GUILD_ID: "guild-1",
        DISCORD_CHANNEL_ID: "channel-1",
        COPANALHAS_MATCH_START_DELETE_AFTER_MINUTES: "0",
        COPANALHAS_MATCH_START_GRACE_MINUTES: "later"
      })
    ).toEqual({
      ok: false,
      errors: [
        "COPANALHAS_MATCH_START_DELETE_AFTER_MINUTES must be a positive integer",
        "COPANALHAS_MATCH_START_GRACE_MINUTES must be a positive integer"
      ]
    });
  });

  test("reports missing required values without echoing secrets", () => {
    expect(parseCopanalhasConfig({ DISCORD_BOT_TOKEN: "token-value" })).toEqual({
      ok: false,
      errors: ["DISCORD_GUILD_ID is required", "DISCORD_CHANNEL_ID is required"]
    });
  });
});
