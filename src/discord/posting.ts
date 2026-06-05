import { Client, GatewayIntentBits } from "discord.js";

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
