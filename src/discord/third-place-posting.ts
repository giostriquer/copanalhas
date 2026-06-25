import { Client, GatewayIntentBits } from "discord.js";

import type { ThirdPlaceDashboardMessage } from "../third-place/format.js";
import type { CopanalhasConfig } from "./config.js";

export interface DiscordThirdPlaceClient {
  login(token: string): Promise<unknown>;
  channels: {
    fetch(channelId: string): Promise<DiscordThirdPlaceChannel | null>;
  };
  destroy(): void | Promise<void>;
}

export interface DiscordThirdPlaceChannel {
  isTextBased(): boolean;
  send?(message: DiscordThirdPlaceMessagePayload): Promise<DiscordThirdPlaceSentMessage>;
  messages?: {
    fetch(messageId: string): Promise<DiscordEditableThirdPlaceMessage>;
  };
}

export interface DiscordEditableThirdPlaceMessage {
  id: string;
  edit(message: DiscordThirdPlaceEditPayload): Promise<DiscordThirdPlaceSentMessage>;
}

export interface DiscordThirdPlaceSentMessage {
  id: string;
}

export interface DiscordThirdPlaceMessagePayload {
  content: string;
  embeds: ThirdPlaceDashboardMessage["embeds"];
  files: ThirdPlaceDashboardMessage["files"];
}

export interface DiscordThirdPlaceEditPayload extends DiscordThirdPlaceMessagePayload {
  attachments: [];
}

export async function upsertDiscordThirdPlaceMessage(
  config: CopanalhasConfig,
  message: ThirdPlaceDashboardMessage,
  existingMessageId: string | null
): Promise<string> {
  return upsertDiscordThirdPlaceMessageWithClient(
    config,
    message,
    existingMessageId,
    new Client({
      intents: [GatewayIntentBits.Guilds]
    })
  );
}

export async function upsertDiscordThirdPlaceMessageWithClient(
  config: CopanalhasConfig,
  message: ThirdPlaceDashboardMessage,
  existingMessageId: string | null,
  client: DiscordThirdPlaceClient
): Promise<string> {
  try {
    await client.login(config.discordToken);
    const channel = await client.channels.fetch(config.channelId);

    if (!channel?.isTextBased() || typeof channel.send !== "function") {
      throw new Error(`Discord channel ${config.channelId} is not available for third-place posts.`);
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

function toDiscordPayload(message: ThirdPlaceDashboardMessage): DiscordThirdPlaceMessagePayload {
  return {
    content: message.content,
    embeds: message.embeds,
    files: message.files
  };
}

function toDiscordEditPayload(
  payload: DiscordThirdPlaceMessagePayload
): DiscordThirdPlaceEditPayload {
  return {
    ...payload,
    attachments: []
  };
}

async function sendReplacement(
  channel: DiscordThirdPlaceChannel,
  payload: DiscordThirdPlaceMessagePayload
): Promise<string> {
  if (typeof channel.send !== "function") {
    throw new Error("Discord channel is not available for third-place posts.");
  }

  const sentMessage = await channel.send(payload);

  return sentMessage.id;
}
