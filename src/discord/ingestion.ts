import { Client, Events, GatewayIntentBits, type Message } from "discord.js";

import { parsePredictionMessage, type PredictionParseResult } from "../predictions/parser.js";
import {
  registerCopanalhasCommands,
  type CopanalhasCommandGuild,
  type RegisterCopanalhasCommandsOptions
} from "./commands.js";
import type { CopanalhasConfig } from "./config.js";
import {
  handleDiscordPredictionInteraction,
  type PredictionInteractionOptions
} from "./interactions.js";
import {
  handleDiscordOperatorAutocomplete,
  handleDiscordOperatorCommand,
  type OperatorAutocompleteResult,
  type OperatorCommandOptions,
  type OperatorCommandResult
} from "./operator-commands.js";

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

export interface DiscordClientReadyOptions {
  registerCommands?(options: RegisterCopanalhasCommandsOptions): Promise<void>;
  operatorCommandOptions?: OperatorCommandOptions;
  logAsyncError?(handler: DiscordAsyncErrorHandler, error: unknown): void;
  handleOperatorCommand?(
    interaction: Parameters<typeof handleDiscordOperatorCommand>[0],
    options: OperatorCommandOptions
  ): Promise<OperatorCommandResult>;
  handleOperatorAutocomplete?(
    interaction: Parameters<typeof handleDiscordOperatorAutocomplete>[0],
    options: OperatorCommandOptions
  ): Promise<OperatorAutocompleteResult>;
}

export type DiscordAsyncErrorHandler =
  | "client-ready"
  | "message-result"
  | "operator-autocomplete"
  | "operator-command"
  | "prediction-interaction";

export interface DiscordReadyClient {
  user: {
    tag: string;
  };
  guilds: {
    fetch(guildId: string): Promise<CopanalhasCommandGuild>;
  };
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
  onMessageResult: (result: DiscordIngestionResult) => void | Promise<void>,
  predictionInteractionOptions?: PredictionInteractionOptions,
  readyOptions: DiscordClientReadyOptions = {}
): Client {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ]
  });

  client.once(Events.ClientReady, (readyClient) => {
    void handleDiscordClientReady(readyClient, config, readyOptions).catch((error: unknown) => {
      logAsyncError(readyOptions, "client-ready", error);
    });
  });

  client.on(Events.MessageCreate, (message) => {
    const result = handleDiscordMessage(fromDiscordMessage(message), {
      guildId: config.guildId,
      channelId: config.channelId,
      parsePrediction: parsePredictionMessage
    });

    void Promise.resolve(onMessageResult(result)).catch((error: unknown) => {
      logAsyncError(readyOptions, "message-result", error);
    });
  });

  if (predictionInteractionOptions || readyOptions.operatorCommandOptions) {
    client.on(Events.InteractionCreate, (interaction) => {
      if (interaction.isAutocomplete() && readyOptions.operatorCommandOptions) {
        void (readyOptions.handleOperatorAutocomplete ?? handleDiscordOperatorAutocomplete)(
          interaction,
          readyOptions.operatorCommandOptions
        ).catch((error: unknown) => {
          logAsyncError(readyOptions, "operator-autocomplete", error);
        });
        return;
      }

      if (interaction.isChatInputCommand() && readyOptions.operatorCommandOptions) {
        void (readyOptions.handleOperatorCommand ?? handleDiscordOperatorCommand)(
          interaction,
          readyOptions.operatorCommandOptions
        ).catch((error: unknown) => {
          logAsyncError(readyOptions, "operator-command", error);
        });
        return;
      }

      if (!predictionInteractionOptions) {
        return;
      }

      void handleDiscordPredictionInteraction(interaction, predictionInteractionOptions).catch(
        (error: unknown) => {
          logAsyncError(readyOptions, "prediction-interaction", error);
        }
      );
    });
  }

  return client;
}

function logAsyncError(
  options: DiscordClientReadyOptions,
  handler: DiscordAsyncErrorHandler,
  error: unknown
): void {
  if (options.logAsyncError) {
    options.logAsyncError(handler, error);
    return;
  }

  console.error(formatAsyncErrorForConsole(handler, error));
}

function formatAsyncErrorForConsole(handler: DiscordAsyncErrorHandler, error: unknown): string {
  return [
    "[discord]",
    `handler=${handler}`,
    `message=${safeErrorMessage(error)}`,
    formatErrorField(error, "code"),
    formatErrorField(error, "status")
  ]
    .filter((part): part is string => part !== null)
    .join(" ");
}

function safeErrorMessage(error: unknown): string {
  const value =
    error instanceof Error && error.message.trim() !== "" ? error.message : String(error);
  const normalized = redactSensitiveLogText(value).trim().replace(/\s+/gu, " ");

  if (normalized === "") {
    return "unknown";
  }

  return normalized.length > 240 ? `${normalized.slice(0, 237)}...` : normalized;
}

function redactSensitiveLogText(value: string): string {
  return value
    .replace(
      /https:\/\/discord\.com\/api\/v\d+\/interactions\/[^/\s]+\/[^/\s]+\/callback(?:\?[^\s]*)?/gu,
      "https://discord.com/api/v*/interactions/[redacted]/[redacted]/callback"
    )
    .replace(/\bBot\s+[A-Za-z0-9._-]+/gu, "Bot [redacted]");
}

function formatErrorField(error: unknown, field: "code" | "status"): string | null {
  if (typeof error !== "object" || error === null || !(field in error)) {
    return null;
  }

  const value = (error as Partial<Record<typeof field, unknown>>)[field];

  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }

  return `${field}=${String(value).trim().replace(/\s+/gu, "_")}`;
}

export async function startDiscordClient(
  config: CopanalhasConfig,
  onMessageResult: (result: DiscordIngestionResult) => void | Promise<void>,
  predictionInteractionOptions?: PredictionInteractionOptions,
  readyOptions?: DiscordClientReadyOptions
): Promise<Client> {
  const client = createDiscordClient(config, onMessageResult, predictionInteractionOptions, readyOptions);
  await client.login(config.discordToken);
  return client;
}

export async function handleDiscordClientReady(
  readyClient: DiscordReadyClient,
  config: CopanalhasConfig,
  options: DiscordClientReadyOptions = {}
): Promise<void> {
  console.log(`Logged in as ${readyClient.user.tag}`);
  await (options.registerCommands ?? registerCopanalhasCommands)({
    guildId: config.guildId,
    fetchGuild: (guildId) => readyClient.guilds.fetch(guildId)
  });
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
