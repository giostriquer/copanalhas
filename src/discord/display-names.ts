import { Buffer } from "node:buffer";

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
  displayAvatarURL?(options?: DiscordAvatarUrlOptions): string;
  user?: {
    displayName?: string | null;
    globalName?: string | null;
    username?: string | null;
    tag?: string | null;
    displayAvatarURL?(options?: DiscordAvatarUrlOptions): string;
  };
}

export interface DiscordAvatarUrlOptions {
  extension?: "png";
  size?: 256;
}

export interface DiscordAvatarImage {
  data: Buffer;
  contentType: string;
}

export type DiscordAvatarImageFetcher = (url: string) => Promise<DiscordAvatarImage>;

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

export async function fetchDiscordUserAvatarDataUris(
  config: CopanalhasConfig,
  userIds: readonly string[]
): Promise<ReadonlyMap<string, string>> {
  return fetchDiscordUserAvatarDataUrisWithClient(
    config,
    userIds,
    new Client({
      intents: [GatewayIntentBits.Guilds]
    }),
    fetchAvatarImage
  );
}

export async function fetchDiscordUserAvatarDataUrisWithClient(
  config: CopanalhasConfig,
  userIds: readonly string[],
  client: DiscordDisplayNameClient,
  fetchAvatar: DiscordAvatarImageFetcher = fetchAvatarImage
): Promise<ReadonlyMap<string, string>> {
  const avatarDataUris = new Map<string, string>();
  const uniqueIds = uniqueUserIds(userIds);

  if (uniqueIds.length === 0) {
    return avatarDataUris;
  }

  try {
    await client.login(config.discordToken);
    const guild = await client.guilds.fetch(config.guildId);

    if (!guild) {
      return avatarDataUris;
    }

    for (const userId of uniqueIds) {
      try {
        const member = await guild.members.fetch(userId);
        const avatarUrl = avatarUrlForMember(member);

        if (!avatarUrl) {
          continue;
        }

        const avatar = await fetchAvatar(avatarUrl);
        avatarDataUris.set(userId, avatarDataUri(avatar));
      } catch {
        // Missing members or avatar fetch failures should not block recap rendering.
      }
    }

    return avatarDataUris;
  } finally {
    await client.destroy();
  }
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

function avatarUrlForMember(member: DiscordDisplayNameGuildMember): string | null {
  return (
    member.displayAvatarURL?.({ extension: "png", size: 256 }) ??
    member.user?.displayAvatarURL?.({ extension: "png", size: 256 }) ??
    null
  );
}

async function fetchAvatarImage(url: string): Promise<DiscordAvatarImage> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Discord avatar fetch failed with HTTP ${response.status}.`);
  }

  const contentType = response.headers.get("content-type")?.split(";")[0]?.trim() || "image/png";

  return {
    data: Buffer.from(await response.arrayBuffer()),
    contentType: contentType.startsWith("image/") ? contentType : "image/png"
  };
}

function avatarDataUri(image: DiscordAvatarImage): string {
  return `data:${image.contentType};base64,${image.data.toString("base64")}`;
}

function firstPresent(values: Array<string | null | undefined>): string | undefined {
  return values.map((value) => value?.trim()).find((value): value is string => !!value);
}

function uniqueUserIds(userIds: readonly string[]): string[] {
  return [...new Set(userIds)];
}
