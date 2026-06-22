import { Client, GatewayIntentBits } from "discord.js";

import type { ChaosDashboardMessage } from "../chaos-dashboard/format.js";
import type { CopanalhasConfig } from "./config.js";

export interface DiscordChaosDashboardClient {
  login(token: string): Promise<unknown>;
  channels: {
    fetch(channelId: string): Promise<DiscordChaosDashboardChannel | null>;
  };
  destroy(): void | Promise<void>;
}

export interface DiscordChaosDashboardChannel {
  isTextBased(): boolean;
  send?(message: DiscordChaosDashboardMessagePayload): Promise<DiscordChaosDashboardSentMessage>;
  messages?: {
    fetch(messageId: string): Promise<DiscordEditableChaosDashboardMessage>;
  };
}

export interface DiscordEditableChaosDashboardMessage {
  id: string;
  edit(message: DiscordChaosDashboardMessagePayload): Promise<DiscordChaosDashboardSentMessage>;
}

export interface DiscordChaosDashboardSentMessage {
  id: string;
}

export interface DiscordChaosDashboardMessagePayload {
  content: string;
  embeds: ChaosDashboardMessage["embeds"];
  files: ChaosDashboardMessage["files"];
}

export async function upsertDiscordChaosDashboardMessage(
  config: CopanalhasConfig,
  message: ChaosDashboardMessage,
  existingMessageId: string | null
): Promise<string> {
  return upsertDiscordChaosDashboardMessageWithClient(
    config,
    message,
    existingMessageId,
    new Client({
      intents: [GatewayIntentBits.Guilds]
    })
  );
}

export async function upsertDiscordChaosDashboardMessageWithClient(
  config: CopanalhasConfig,
  message: ChaosDashboardMessage,
  existingMessageId: string | null,
  client: DiscordChaosDashboardClient
): Promise<string> {
  try {
    await client.login(config.discordToken);
    const channel = await client.channels.fetch(config.channelId);

    if (!channel?.isTextBased() || typeof channel.send !== "function") {
      throw new Error(
        `Discord channel ${config.channelId} is not available for chaos dashboard posts.`
      );
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

function toDiscordPayload(message: ChaosDashboardMessage): DiscordChaosDashboardMessagePayload {
  return {
    content: message.content,
    embeds: message.embeds,
    files: message.files
  };
}

async function sendReplacement(
  channel: DiscordChaosDashboardChannel,
  payload: DiscordChaosDashboardMessagePayload
): Promise<string> {
  if (typeof channel.send !== "function") {
    throw new Error("Discord channel is not available for chaos dashboard posts.");
  }

  const sentMessage = await channel.send(payload);

  return sentMessage.id;
}
