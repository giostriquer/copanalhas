export interface CopanalhasConfig {
  discordToken: string;
  guildId: string;
  channelId: string;
  databasePath: string;
  autoPostEnabled: boolean;
  autoPostTime: string;
  timezone: string;
  matchdayRolloverTime: string;
  footballDataToken: string | null;
  resultSyncEnabled: boolean;
  resultSyncFirstCheckMinutes: number;
  resultSyncRetryMinutes: number;
}

export type CopanalhasConfigResult =
  | { ok: true; config: CopanalhasConfig }
  | { ok: false; errors: string[] };

export function parseCopanalhasConfig(
  env: Record<string, string | undefined>
): CopanalhasConfigResult {
  const errors: string[] = [];
  const discordToken = clean(env.DISCORD_BOT_TOKEN);
  const guildId = clean(env.DISCORD_GUILD_ID);
  const channelId = clean(env.DISCORD_CHANNEL_ID);
  const databasePath = clean(env.COPANALHAS_DATABASE_PATH) ?? "./data/copanalhas.sqlite";
  const autoPostEnabled = clean(env.COPANALHAS_AUTO_POST_ENABLED)?.toLowerCase() !== "false";
  const autoPostTime = clean(env.COPANALHAS_AUTO_POST_TIME) ?? "09:00";
  const timezone = clean(env.COPANALHAS_TIMEZONE) ?? "America/Sao_Paulo";
  const matchdayRolloverTime = clean(env.COPANALHAS_MATCHDAY_ROLLOVER_TIME) ?? "06:00";
  const footballDataToken = clean(env.FOOTBALL_DATA_TOKEN) ?? null;
  const resultSyncSetting = clean(env.COPANALHAS_RESULT_SYNC_ENABLED)?.toLowerCase();
  const resultSyncEnabled =
    footballDataToken !== null && (resultSyncSetting === undefined || resultSyncSetting === "true");
  const resultSyncFirstCheckMinutes = parsePositiveInteger(
    clean(env.COPANALHAS_RESULT_SYNC_FIRST_CHECK_MINUTES) ?? "135"
  );
  const resultSyncRetryMinutes = parsePositiveInteger(
    clean(env.COPANALHAS_RESULT_SYNC_RETRY_MINUTES) ?? "30"
  );

  if (!discordToken) {
    errors.push("DISCORD_BOT_TOKEN is required");
  }

  if (!guildId) {
    errors.push("DISCORD_GUILD_ID is required");
  }

  if (!channelId) {
    errors.push("DISCORD_CHANNEL_ID is required");
  }

  if (!isValidTime(autoPostTime)) {
    errors.push("COPANALHAS_AUTO_POST_TIME must use HH:mm");
  }

  if (!isValidTime(matchdayRolloverTime)) {
    errors.push("COPANALHAS_MATCHDAY_ROLLOVER_TIME must use HH:mm");
  }

  if (resultSyncFirstCheckMinutes === undefined) {
    errors.push("COPANALHAS_RESULT_SYNC_FIRST_CHECK_MINUTES must be a positive integer");
  }

  if (resultSyncRetryMinutes === undefined) {
    errors.push("COPANALHAS_RESULT_SYNC_RETRY_MINUTES must be a positive integer");
  }

  if (
    errors.length > 0 ||
    !discordToken ||
    !guildId ||
    !channelId ||
    resultSyncFirstCheckMinutes === undefined ||
    resultSyncRetryMinutes === undefined
  ) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    config: {
      discordToken,
      guildId,
      channelId,
      databasePath,
      autoPostEnabled,
      autoPostTime,
      timezone,
      matchdayRolloverTime,
      footballDataToken,
      resultSyncEnabled,
      resultSyncFirstCheckMinutes,
      resultSyncRetryMinutes
    }
  };
}

function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed === "" ? undefined : trimmed;
}

function isValidTime(value: string): boolean {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/u.test(value);
}

function parsePositiveInteger(value: string): number | undefined {
  if (!/^\d+$/u.test(value)) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);

  return parsed > 0 ? parsed : undefined;
}
