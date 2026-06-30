export interface CopanalhasConfig {
  discordToken: string;
  guildId: string;
  channelId: string;
  databasePath: string;
  autoPostEnabled: boolean;
  autoPostTime: string;
  autoPostWindowDays: number;
  timezone: string;
  matchdayRolloverTime: string;
  footballDataToken: string | null;
  resultSyncEnabled: boolean;
  resultSyncFirstCheckMinutes: number;
  resultSyncRetryMinutes: number;
  matchStartRoleId?: string | null;
  matchStartAlertDeleteAfterMinutes?: number;
  matchStartAlertLeadMinutes?: number;
  matchStartAlertGraceMinutes?: number;
  ownerUserId?: string | null;
  recapCodexEnabled: boolean;
  recapCodexCommand: string;
  recapCodexOutputDir: string;
  recapCodexTimeoutMs: number;
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
  const autoPostWindowDays = parsePositiveInteger(
    clean(env.COPANALHAS_AUTO_POST_WINDOW_DAYS) ?? "3"
  );
  const timezone = clean(env.COPANALHAS_TIMEZONE) ?? "America/Sao_Paulo";
  const matchdayRolloverTime = clean(env.COPANALHAS_MATCHDAY_ROLLOVER_TIME) ?? "06:00";
  const footballDataToken = clean(env.FOOTBALL_DATA_TOKEN) ?? null;
  const resultSyncSetting = clean(env.COPANALHAS_RESULT_SYNC_ENABLED)?.toLowerCase();
  const resultSyncEnabled =
    footballDataToken !== null && (resultSyncSetting === undefined || resultSyncSetting === "true");
  const resultSyncFirstCheckMinutes = parsePositiveInteger(
    clean(env.COPANALHAS_RESULT_SYNC_FIRST_CHECK_MINUTES) ?? "110"
  );
  const resultSyncRetryMinutes = parsePositiveInteger(
    clean(env.COPANALHAS_RESULT_SYNC_RETRY_MINUTES) ?? "1"
  );
  const matchStartRoleId = clean(env.COPANALHAS_MATCH_START_ROLE_ID) ?? null;
  const matchStartAlertDeleteAfterMinutes = parsePositiveInteger(
    clean(env.COPANALHAS_MATCH_START_DELETE_AFTER_MINUTES) ?? "180"
  );
  const matchStartAlertLeadMinutes = parseNonNegativeInteger(
    clean(env.COPANALHAS_MATCH_START_LEAD_MINUTES) ?? "5"
  );
  const matchStartAlertGraceMinutes = parsePositiveInteger(
    clean(env.COPANALHAS_MATCH_START_GRACE_MINUTES) ?? "5"
  );
  const ownerUserId = clean(env.COPANALHAS_OWNER_USER_ID) ?? null;
  const recapCodexEnabled = clean(env.COPANALHAS_RECAP_CODEX_ENABLED)?.toLowerCase() === "true";
  const recapCodexCommand = clean(env.COPANALHAS_RECAP_CODEX_COMMAND) ?? "codex";
  const recapCodexOutputDir = clean(env.COPANALHAS_RECAP_CODEX_OUTPUT_DIR) ?? "./data/recap-copy";
  const recapCodexTimeoutMs = parsePositiveInteger(
    clean(env.COPANALHAS_RECAP_CODEX_TIMEOUT_MS) ?? "120000"
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

  if (autoPostWindowDays === undefined) {
    errors.push("COPANALHAS_AUTO_POST_WINDOW_DAYS must be a positive integer");
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

  if (matchStartAlertDeleteAfterMinutes === undefined) {
    errors.push("COPANALHAS_MATCH_START_DELETE_AFTER_MINUTES must be a positive integer");
  }

  if (matchStartAlertLeadMinutes === undefined) {
    errors.push("COPANALHAS_MATCH_START_LEAD_MINUTES must be a non-negative integer");
  }

  if (matchStartAlertGraceMinutes === undefined) {
    errors.push("COPANALHAS_MATCH_START_GRACE_MINUTES must be a positive integer");
  }

  if (recapCodexTimeoutMs === undefined) {
    errors.push("COPANALHAS_RECAP_CODEX_TIMEOUT_MS must be a positive integer");
  }

  if (
    errors.length > 0 ||
    !discordToken ||
    !guildId ||
    !channelId ||
    autoPostWindowDays === undefined ||
    resultSyncFirstCheckMinutes === undefined ||
    resultSyncRetryMinutes === undefined ||
    matchStartAlertDeleteAfterMinutes === undefined ||
    matchStartAlertLeadMinutes === undefined ||
    matchStartAlertGraceMinutes === undefined ||
    recapCodexTimeoutMs === undefined
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
      autoPostWindowDays,
      timezone,
      matchdayRolloverTime,
      footballDataToken,
      resultSyncEnabled,
      resultSyncFirstCheckMinutes,
      resultSyncRetryMinutes,
      matchStartRoleId,
      matchStartAlertDeleteAfterMinutes,
      matchStartAlertLeadMinutes,
      matchStartAlertGraceMinutes,
      ownerUserId,
      recapCodexEnabled,
      recapCodexCommand,
      recapCodexOutputDir,
      recapCodexTimeoutMs
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

function parseNonNegativeInteger(value: string): number | undefined {
  if (!/^\d+$/u.test(value)) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);

  return parsed >= 0 ? parsed : undefined;
}
