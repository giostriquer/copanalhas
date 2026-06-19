import { Client, GatewayIntentBits } from "discord.js";

import type { BracketDashboardMessage } from "../bracket/format.js";
import type { CopanalhasConfig } from "./config.js";

export interface DiscordBracketClient {
  login(token: string): Promise<unknown>;
  channels: {
    fetch(channelId: string): Promise<DiscordBracketChannel | null>;
  };
  destroy(): void | Promise<void>;
}

export interface DiscordBracketChannel {
  isTextBased(): boolean;
  send?(message: DiscordBracketMessagePayload): Promise<DiscordBracketSentMessage>;
  messages?: {
    fetch(messageId: string): Promise<DiscordEditableBracketMessage>;
  };
}

export interface DiscordEditableBracketMessage {
  id: string;
  edit(message: DiscordBracketMessagePayload): Promise<DiscordBracketSentMessage>;
}

export interface DiscordBracketSentMessage {
  id: string;
}

export interface DiscordBracketMessagePayload {
  content: string;
  embeds: BracketDashboardMessage["embeds"];
  files: BracketDashboardMessage["files"];
}

export async function upsertDiscordBracketMessage(
  config: CopanalhasConfig,
  message: BracketDashboardMessage,
  existingMessageId: string | null
): Promise<string> {
  return upsertDiscordBracketMessageWithClient(
    config,
    message,
    existingMessageId,
    new Client({
      intents: [GatewayIntentBits.Guilds]
    })
  );
}

export async function upsertDiscordBracketMessageWithClient(
  config: CopanalhasConfig,
  message: BracketDashboardMessage,
  existingMessageId: string | null,
  client: DiscordBracketClient
): Promise<string> {
  try {
    await client.login(config.discordToken);
    const channel = await client.channels.fetch(config.channelId);

    if (!channel?.isTextBased() || typeof channel.send !== "function") {
      throw new Error(`Discord channel ${config.channelId} is not available for bracket posts.`);
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

function toDiscordPayload(message: BracketDashboardMessage): DiscordBracketMessagePayload {
  return {
    content: message.content,
    embeds: message.embeds,
    files: message.files
  };
}

async function sendReplacement(
  channel: DiscordBracketChannel,
  payload: DiscordBracketMessagePayload
): Promise<string> {
  if (typeof channel.send !== "function") {
    throw new Error("Discord channel is not available for bracket posts.");
  }

  const sentMessage = await channel.send(payload);

  return sentMessage.id;
}
