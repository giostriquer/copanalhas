import { Client, GatewayIntentBits } from "discord.js";

import type { LeaderboardDashboardMessage } from "../leaderboard/format.js";
import type { CopanalhasConfig } from "./config.js";

export interface DiscordLeaderboardClient {
  login(token: string): Promise<unknown>;
  channels: {
    fetch(channelId: string): Promise<DiscordLeaderboardChannel | null>;
  };
  destroy(): void | Promise<void>;
}

export interface DiscordLeaderboardChannel {
  isTextBased(): boolean;
  send?(message: DiscordLeaderboardMessagePayload): Promise<DiscordLeaderboardSentMessage>;
  messages?: {
    fetch(messageId: string): Promise<DiscordEditableLeaderboardMessage>;
  };
}

export interface DiscordEditableLeaderboardMessage {
  id: string;
  edit(message: DiscordLeaderboardMessagePayload): Promise<DiscordLeaderboardSentMessage>;
}

export interface DiscordLeaderboardSentMessage {
  id: string;
}

export interface DiscordLeaderboardMessagePayload {
  content: string;
  embeds: LeaderboardDashboardMessage["embeds"];
}

export async function upsertDiscordLeaderboardMessage(
  config: CopanalhasConfig,
  message: LeaderboardDashboardMessage,
  existingMessageId: string | null
): Promise<string> {
  return upsertDiscordLeaderboardMessageWithClient(
    config,
    message,
    existingMessageId,
    new Client({
      intents: [GatewayIntentBits.Guilds]
    })
  );
}

export async function upsertDiscordLeaderboardMessageWithClient(
  config: CopanalhasConfig,
  message: LeaderboardDashboardMessage,
  existingMessageId: string | null,
  client: DiscordLeaderboardClient
): Promise<string> {
  try {
    await client.login(config.discordToken);
    const channel = await client.channels.fetch(config.channelId);

    if (!channel?.isTextBased() || typeof channel.send !== "function") {
      throw new Error(`Discord channel ${config.channelId} is not available for leaderboard posts.`);
    }

    const payload = toDiscordPayload(message);

    if (existingMessageId && channel.messages) {
      try {
        const existingMessage = await channel.messages.fetch(existingMessageId);
        const editedMessage = await existingMessage.edit(payload);

        return editedMessage.id;
      } catch {
        return sendReplacement(channel, payload);
      }
    }

    return sendReplacement(channel, payload);
  } finally {
    await client.destroy();
  }
}

function toDiscordPayload(message: LeaderboardDashboardMessage): DiscordLeaderboardMessagePayload {
  return {
    content: message.content,
    embeds: message.embeds
  };
}

async function sendReplacement(
  channel: DiscordLeaderboardChannel,
  payload: DiscordLeaderboardMessagePayload
): Promise<string> {
  if (typeof channel.send !== "function") {
    throw new Error("Discord channel is not available for leaderboard posts.");
  }

  const sentMessage = await channel.send(payload);

  return sentMessage.id;
}
