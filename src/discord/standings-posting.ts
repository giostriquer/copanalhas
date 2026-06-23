import { Client, GatewayIntentBits } from "discord.js";

import type { StandingsDashboardMessage } from "../standings/format.js";
import type { CopanalhasConfig } from "./config.js";

export interface DiscordStandingsClient {
  login(token: string): Promise<unknown>;
  channels: {
    fetch(channelId: string): Promise<DiscordStandingsChannel | null>;
  };
  destroy(): void | Promise<void>;
}

export interface DiscordStandingsChannel {
  isTextBased(): boolean;
  send?(message: DiscordStandingsMessagePayload): Promise<DiscordStandingsSentMessage>;
  messages?: {
    fetch(messageId: string): Promise<DiscordEditableStandingsMessage>;
  };
}

export interface DiscordEditableStandingsMessage {
  id: string;
  edit(message: DiscordStandingsEditPayload): Promise<DiscordStandingsSentMessage>;
}

export interface DiscordStandingsSentMessage {
  id: string;
}

export interface DiscordStandingsMessagePayload {
  content: string;
  embeds: StandingsDashboardMessage["embeds"];
  files: StandingsDashboardMessage["files"];
}

export interface DiscordStandingsEditPayload extends DiscordStandingsMessagePayload {
  attachments: [];
}

export async function upsertDiscordStandingsMessage(
  config: CopanalhasConfig,
  message: StandingsDashboardMessage,
  existingMessageId: string | null
): Promise<string> {
  return upsertDiscordStandingsMessageWithClient(
    config,
    message,
    existingMessageId,
    new Client({
      intents: [GatewayIntentBits.Guilds]
    })
  );
}

export async function upsertDiscordStandingsMessageWithClient(
  config: CopanalhasConfig,
  message: StandingsDashboardMessage,
  existingMessageId: string | null,
  client: DiscordStandingsClient
): Promise<string> {
  try {
    await client.login(config.discordToken);
    const channel = await client.channels.fetch(config.channelId);

    if (!channel?.isTextBased() || typeof channel.send !== "function") {
      throw new Error(`Discord channel ${config.channelId} is not available for standings posts.`);
    }

    const payload = toDiscordPayload(message);

    if (existingMessageId && channel.messages) {
      try {
        const existingMessage = await channel.messages.fetch(existingMessageId);
        const editedMessage = await existingMessage.edit(toDiscordEditPayload(payload));

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

function toDiscordPayload(message: StandingsDashboardMessage): DiscordStandingsMessagePayload {
  return {
    content: message.content,
    embeds: message.embeds,
    files: message.files
  };
}

function toDiscordEditPayload(
  payload: DiscordStandingsMessagePayload
): DiscordStandingsEditPayload {
  return {
    ...payload,
    attachments: []
  };
}

async function sendReplacement(
  channel: DiscordStandingsChannel,
  payload: DiscordStandingsMessagePayload
): Promise<string> {
  if (typeof channel.send !== "function") {
    throw new Error("Discord channel is not available for standings posts.");
  }

  const sentMessage = await channel.send(payload);

  return sentMessage.id;
}
