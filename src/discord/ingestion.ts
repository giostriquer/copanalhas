import { Client, Events, GatewayIntentBits, type Message } from "discord.js";

import { parsePredictionMessage, type PredictionParseResult } from "../predictions/parser.js";
import type { CopanalhasConfig } from "./config.js";

export const parserVersion = "prediction-parser-v1";

export interface DiscordMessageInput {
  id: string;
  guildId: string | null;
  channelId: string;
  authorId: string;
  authorIsBot: boolean;
  content: string;
  createdAt: Date;
  editedAt: Date | null;
}

export interface DiscordIngestionOptions {
  guildId: string;
  channelId: string;
  parsePrediction: (content: string) => PredictionParseResult;
}

export type DiscordIngestionResult =
  | { action: "ignored"; reason: "wrong-guild" | "wrong-channel" | "bot-author" | "empty-content" }
  | {
      action: "rejected";
      reason: Extract<PredictionParseResult, { ok: false }>["reason"];
      messageId: string;
      userId: string;
    }
  | {
      action: "accepted";
      prediction: AcceptedDiscordPrediction;
    };

export interface AcceptedDiscordPrediction {
  userId: string;
  messageId: string;
  matchNumber: number | undefined;
  homeTeamCode: string;
  awayTeamCode: string;
  homeScore: number;
  awayScore: number;
  submittedAt: string;
  updatedAt: string | null;
  parserVersion: string;
}

export function handleDiscordMessage(
  message: DiscordMessageInput,
  options: DiscordIngestionOptions
): DiscordIngestionResult {
  if (message.guildId !== options.guildId) {
    return { action: "ignored", reason: "wrong-guild" };
  }

  if (message.channelId !== options.channelId) {
    return { action: "ignored", reason: "wrong-channel" };
  }

  if (message.authorIsBot) {
    return { action: "ignored", reason: "bot-author" };
  }

  if (message.content.trim() === "") {
    return { action: "ignored", reason: "empty-content" };
  }

  const parsed = options.parsePrediction(message.content);

  if (!parsed.ok) {
    return {
      action: "rejected",
      reason: parsed.reason,
      messageId: message.id,
      userId: message.authorId
    };
  }

  return {
    action: "accepted",
    prediction: {
      userId: message.authorId,
      messageId: message.id,
      matchNumber: parsed.prediction.matchNumber,
      homeTeamCode: parsed.prediction.homeTeamCode,
      awayTeamCode: parsed.prediction.awayTeamCode,
      homeScore: parsed.prediction.homeScore,
      awayScore: parsed.prediction.awayScore,
      submittedAt: message.createdAt.toISOString(),
      updatedAt: message.editedAt?.toISOString() ?? null,
      parserVersion
    }
  };
}

export function createDiscordClient(
  config: CopanalhasConfig,
  onMessageResult: (result: DiscordIngestionResult) => void
): Client {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ]
  });

  client.once(Events.ClientReady, (readyClient) => {
    console.log(`Logged in as ${readyClient.user.tag}`);
  });

  client.on(Events.MessageCreate, (message) => {
    const result = handleDiscordMessage(fromDiscordMessage(message), {
      guildId: config.guildId,
      channelId: config.channelId,
      parsePrediction: parsePredictionMessage
    });

    onMessageResult(result);
  });

  return client;
}

export async function startDiscordClient(
  config: CopanalhasConfig,
  onMessageResult: (result: DiscordIngestionResult) => void
): Promise<Client> {
  const client = createDiscordClient(config, onMessageResult);
  await client.login(config.discordToken);
  return client;
}

function fromDiscordMessage(message: Message): DiscordMessageInput {
  return {
    id: message.id,
    guildId: message.guildId,
    channelId: message.channelId,
    authorId: message.author.id,
    authorIsBot: message.author.bot,
    content: message.content,
    createdAt: message.createdAt,
    editedAt: message.editedAt
  };
}
