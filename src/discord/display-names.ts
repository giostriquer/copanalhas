import { Client, GatewayIntentBits } from "discord.js";

import type { CopanalhasConfig } from "./config.js";

export interface DiscordDisplayNameClient {
  login(token: string): Promise<unknown>;
  guilds: {
    fetch(guildId: string): Promise<DiscordDisplayNameGuild | null>;
  };
  destroy(): void | Promise<void>;
}

export interface DiscordDisplayNameGuild {
  members: {
    fetch(userId: string): Promise<DiscordDisplayNameGuildMember>;
  };
}

export interface DiscordDisplayNameGuildMember {
  displayName?: string | null;
  user?: {
    displayName?: string | null;
    globalName?: string | null;
    username?: string | null;
    tag?: string | null;
  };
}

export async function fetchDiscordDisplayNames(
  config: CopanalhasConfig,
  userIds: readonly string[]
): Promise<ReadonlyMap<string, string>> {
  return fetchDiscordDisplayNamesWithClient(
    config,
    userIds,
    new Client({
      intents: [GatewayIntentBits.Guilds]
    })
  );
}

export async function fetchDiscordDisplayNamesWithClient(
  config: CopanalhasConfig,
  userIds: readonly string[],
  client: DiscordDisplayNameClient
): Promise<ReadonlyMap<string, string>> {
  const displayNames = new Map(uniqueUserIds(userIds).map((userId) => [userId, userId]));

  if (displayNames.size === 0) {
    return displayNames;
  }

  try {
    await client.login(config.discordToken);
    const guild = await client.guilds.fetch(config.guildId);

    if (!guild) {
      return displayNames;
    }

    for (const userId of displayNames.keys()) {
      try {
        const member = await guild.members.fetch(userId);
        displayNames.set(userId, displayNameForMember(member, userId));
      } catch {
        displayNames.set(userId, userId);
      }
    }

    return displayNames;
  } finally {
    await client.destroy();
  }
}

function displayNameForMember(member: DiscordDisplayNameGuildMember, userId: string): string {
  return (
    firstPresent([
      member.displayName,
      member.user?.displayName,
      member.user?.globalName,
      member.user?.username,
      member.user?.tag
    ]) ?? userId
  );
}

function firstPresent(values: Array<string | null | undefined>): string | undefined {
  return values.map((value) => value?.trim()).find((value): value is string => !!value);
}

function uniqueUserIds(userIds: readonly string[]): string[] {
  return [...new Set(userIds)];
}
