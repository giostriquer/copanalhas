import { Client, GatewayIntentBits, ThreadAutoArchiveDuration } from "discord.js";

import type { CopanalhasConfig } from "./config.js";
import type {
  PredictionRevealSendResult,
  PredictionRevealThreadMessage
} from "../app/prediction-reveal-posting.js";

export type { PredictionRevealThreadMessage };

export interface DiscordPredictionRevealClient {
  login(token: string): Promise<unknown>;
  channels: {
    fetch(channelId: string): Promise<DiscordPredictionRevealChannel | null>;
  };
  destroy(): void | Promise<void>;
}

export interface DiscordPredictionRevealChannel {
  isTextBased(): boolean;
  messages?: {
    fetch(messageId: string): Promise<DiscordPredictionRevealParentMessage>;
  };
}

export interface DiscordPredictionRevealParentMessage {
  thread?: DiscordPredictionRevealThread | null;
  startThread?(options: {
    name: string;
    autoArchiveDuration: ThreadAutoArchiveDuration;
    reason: string;
  }): Promise<DiscordPredictionRevealThread>;
}

export interface DiscordPredictionRevealThread {
  id: string;
  archived?: boolean | null;
  setArchived?(archived: boolean): Promise<unknown>;
  send(message: {
    content: string;
    allowedMentions: { parse: [] };
  }): Promise<{ id: string }>;
}

export async function postDiscordPredictionReveal(
  config: CopanalhasConfig,
  message: PredictionRevealThreadMessage
): Promise<PredictionRevealSendResult> {
  return postPredictionRevealWithClient(
    config,
    message,
    new Client({
      intents: [GatewayIntentBits.Guilds]
    }) as unknown as DiscordPredictionRevealClient
  );
}

export async function postPredictionRevealWithClient(
  config: CopanalhasConfig,
  message: PredictionRevealThreadMessage,
  client: DiscordPredictionRevealClient
): Promise<PredictionRevealSendResult> {
  try {
    await client.login(config.discordToken);
    const channel = await client.channels.fetch(config.channelId);

    if (!channel?.isTextBased() || !channel.messages) {
      throw new Error(`Discord channel ${config.channelId} is not available for thread reveals.`);
    }

    const parentMessage = await channel.messages.fetch(message.parentMessageId);
    const thread = await ensureRevealThread(parentMessage, message.threadName);
    const sentMessage = await thread.send({
      content: message.content,
      allowedMentions: { parse: [] }
    });

    return {
      threadId: thread.id,
      messageId: sentMessage.id
    };
  } finally {
    await client.destroy();
  }
}

async function ensureRevealThread(
  parentMessage: DiscordPredictionRevealParentMessage,
  threadName: string
): Promise<DiscordPredictionRevealThread> {
  const existingThread = parentMessage.thread ?? null;

  if (existingThread) {
    if (existingThread.archived && existingThread.setArchived) {
      await existingThread.setArchived(false);
    }

    return existingThread;
  }

  if (!parentMessage.startThread) {
    throw new Error("Discord matchday message cannot start a prediction reveal thread.");
  }

  return parentMessage.startThread({
    name: threadName,
    autoArchiveDuration: ThreadAutoArchiveDuration.OneDay,
    reason: "Post locked Copanalhas predictions"
  });
}
