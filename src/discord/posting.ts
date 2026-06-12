import { Client, GatewayIntentBits } from "discord.js";

import type { MatchStartAlertMessage } from "../app/match-start-alerts.js";
import type { MatchCardMessage } from "./components.js";
import type { CopanalhasConfig } from "./config.js";

export interface DiscordPosterClient {
  login(token: string): Promise<unknown>;
  channels: {
    fetch(channelId: string): Promise<DiscordPosterChannel | null>;
  };
  destroy(): void | Promise<void>;
}

export interface DiscordPosterChannel {
  isTextBased(): boolean;
  send?(message: MatchCardMessage): Promise<DiscordSentMessage>;
}

export interface DiscordSentMessage {
  id: string;
}

export interface DiscordMatchStartAlertClient {
  login(token: string): Promise<unknown>;
  channels: {
    fetch(channelId: string): Promise<DiscordMatchStartAlertChannel | null>;
  };
  destroy(): void | Promise<void>;
}

export interface DiscordMatchStartAlertChannel {
  isTextBased(): boolean;
  send?(message: MatchStartAlertMessage): Promise<DiscordSentMessage>;
  messages?: {
    fetch(messageId: string): Promise<DiscordDeletableMessage>;
  };
}

export interface DiscordDeletableMessage {
  delete(): Promise<unknown>;
}

export async function postDiscordMatchCards(
  config: CopanalhasConfig,
  messages: MatchCardMessage[]
): Promise<string[]> {
  return postMatchCardsWithClient(
    config,
    messages,
    new Client({
      intents: [GatewayIntentBits.Guilds]
    })
  );
}

export async function postMatchCardsWithClient(
  config: CopanalhasConfig,
  messages: MatchCardMessage[],
  client: DiscordPosterClient
): Promise<string[]> {
  const messageIds: string[] = [];

  try {
    await client.login(config.discordToken);
    const channel = await client.channels.fetch(config.channelId);

    if (!channel?.isTextBased() || typeof channel.send !== "function") {
      throw new Error(`Discord channel ${config.channelId} is not available for text messages.`);
    }

    for (const message of messages) {
      const sentMessage = await channel.send(message);
      messageIds.push(sentMessage.id);
    }
  } finally {
    await client.destroy();
  }

  return messageIds;
}

export async function postDiscordMatchStartAlert(
  config: CopanalhasConfig,
  message: MatchStartAlertMessage
): Promise<string> {
  return postMatchStartAlertWithClient(
    config,
    message,
    new Client({
      intents: [GatewayIntentBits.Guilds]
    }) as unknown as DiscordMatchStartAlertClient
  );
}

export async function deleteDiscordMatchStartAlert(
  config: CopanalhasConfig,
  messageId: string
): Promise<void> {
  return deleteMatchStartAlertWithClient(
    config,
    messageId,
    new Client({
      intents: [GatewayIntentBits.Guilds]
    }) as unknown as DiscordMatchStartAlertClient
  );
}

export async function postMatchStartAlertWithClient(
  config: CopanalhasConfig,
  message: MatchStartAlertMessage,
  client: DiscordMatchStartAlertClient
): Promise<string> {
  try {
    await client.login(config.discordToken);
    const channel = await client.channels.fetch(config.channelId);

    if (!channel?.isTextBased() || typeof channel.send !== "function") {
      throw new Error(
        `Discord channel ${config.channelId} is not available for match start alerts.`
      );
    }

    const sentMessage = await channel.send(message);

    return sentMessage.id;
  } finally {
    await client.destroy();
  }
}

export async function deleteMatchStartAlertWithClient(
  config: CopanalhasConfig,
  messageId: string,
  client: DiscordMatchStartAlertClient
): Promise<void> {
  try {
    await client.login(config.discordToken);
    const channel = await client.channels.fetch(config.channelId);

    if (!channel?.isTextBased() || typeof channel.messages?.fetch !== "function") {
      throw new Error(
        `Discord channel ${config.channelId} is not available for match start alert deletion.`
      );
    }

    const message = await channel.messages.fetch(messageId);
    await message.delete();
  } finally {
    await client.destroy();
  }
}
