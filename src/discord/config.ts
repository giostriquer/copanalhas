export interface CopanalhasConfig {
  discordToken: string;
  guildId: string;
  channelId: string;
  databasePath: string;
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

  if (!discordToken) {
    errors.push("DISCORD_BOT_TOKEN is required");
  }

  if (!guildId) {
    errors.push("DISCORD_GUILD_ID is required");
  }

  if (!channelId) {
    errors.push("DISCORD_CHANNEL_ID is required");
  }

  if (errors.length > 0 || !discordToken || !guildId || !channelId) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    config: {
      discordToken,
      guildId,
      channelId,
      databasePath
    }
  };
}

function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed === "" ? undefined : trimmed;
}
