import { MessageFlags, type Interaction, type ModalBuilder } from "discord.js";

import {
  createPredictionModal,
  parsePredictButtonCustomId,
  parseScoreModalCustomId,
  scoreInputCustomId
} from "./components.js";
import { parseScoreInput } from "../predictions/score-parser.js";
import type { StoredPrediction } from "../storage/database.js";
import type { WorldCupMatch } from "../worldcup/types.js";

export const modalPredictionParserVersion = "prediction-modal-v1";

export interface PredictionInteractionOptions {
  guildId: string;
  channelId: string;
  matches: WorldCupMatch[];
  upsertPrediction(prediction: StoredPrediction): void | Promise<void>;
}

export type PredictionInteraction = PredictionButtonInteraction | PredictionModalSubmitInteraction;

export interface PredictionButtonInteraction {
  kind: "button";
  customId: string;
  guildId: string | null;
  channelId: string;
  userId: string;
  showModal(modal: ModalBuilder): Promise<void>;
  reply(reply: PredictionInteractionReply): Promise<void>;
}

export interface PredictionModalSubmitInteraction {
  kind: "modal-submit";
  customId: string;
  guildId: string | null;
  channelId: string;
  userId: string;
  interactionId: string;
  createdAt: Date;
  getTextInputValue(customId: string): string;
  reply(reply: PredictionInteractionReply): Promise<void>;
}

export interface PredictionInteractionReply {
  content: string;
  ephemeral: true;
}

export type PredictionInteractionResult =
  | {
      action: "ignored";
      reason: "wrong-guild" | "wrong-channel" | "invalid-custom-id" | "unsupported-interaction";
    }
  | {
      action: "opened-modal";
      matchId: string;
    }
  | {
      action: "rejected";
      reason: "unknown-match" | "invalid-score-format";
      matchId: string;
      userId: string;
    }
  | {
      action: "accepted";
      prediction: StoredPrediction;
    };

export async function handlePredictionInteraction(
  interaction: PredictionInteraction,
  options: PredictionInteractionOptions
): Promise<PredictionInteractionResult> {
  if (interaction.guildId !== options.guildId) {
    return { action: "ignored", reason: "wrong-guild" };
  }

  if (interaction.channelId !== options.channelId) {
    return { action: "ignored", reason: "wrong-channel" };
  }

  const matchesById = new Map(options.matches.map((match) => [match.id, match]));

  if (interaction.kind === "button") {
    return handlePredictButton(interaction, matchesById);
  }

  return handleScoreModal(interaction, matchesById, options);
}

export async function handleDiscordPredictionInteraction(
  interaction: Interaction,
  options: PredictionInteractionOptions
): Promise<PredictionInteractionResult> {
  if (!interaction.channelId) {
    return { action: "ignored", reason: "wrong-channel" };
  }

  if (interaction.isButton()) {
    return handlePredictionInteraction(
      {
        kind: "button",
        customId: interaction.customId,
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        userId: interaction.user.id,
        showModal: async (modal) => {
          await interaction.showModal(modal);
        },
        reply: async (reply) => {
          await interaction.reply({
            content: reply.content,
            flags: MessageFlags.Ephemeral
          });
        }
      },
      options
    );
  }

  if (interaction.isModalSubmit()) {
    return handlePredictionInteraction(
      {
        kind: "modal-submit",
        customId: interaction.customId,
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        userId: interaction.user.id,
        interactionId: interaction.id,
        createdAt: interaction.createdAt,
        getTextInputValue: (customId) => interaction.fields.getTextInputValue(customId),
        reply: async (reply) => {
          await interaction.reply({
            content: reply.content,
            flags: MessageFlags.Ephemeral
          });
        }
      },
      options
    );
  }

  return { action: "ignored", reason: "unsupported-interaction" };
}

async function handlePredictButton(
  interaction: PredictionButtonInteraction,
  matchesById: Map<string, WorldCupMatch>
): Promise<PredictionInteractionResult> {
  const parsed = parsePredictButtonCustomId(interaction.customId);

  if (!parsed) {
    return { action: "ignored", reason: "invalid-custom-id" };
  }

  const match = matchesById.get(parsed.matchId);

  if (!match) {
    await interaction.reply({
      content: "I could not find that World Cup match.",
      ephemeral: true
    });
    return {
      action: "rejected",
      reason: "unknown-match",
      matchId: parsed.matchId,
      userId: interaction.userId
    };
  }

  await interaction.showModal(createPredictionModal(match));

  return { action: "opened-modal", matchId: match.id };
}

async function handleScoreModal(
  interaction: PredictionModalSubmitInteraction,
  matchesById: Map<string, WorldCupMatch>,
  options: PredictionInteractionOptions
): Promise<PredictionInteractionResult> {
  const parsed = parseScoreModalCustomId(interaction.customId);

  if (!parsed) {
    return { action: "ignored", reason: "invalid-custom-id" };
  }

  const match = matchesById.get(parsed.matchId);

  if (!match) {
    await interaction.reply({
      content: "I could not find that World Cup match.",
      ephemeral: true
    });
    return {
      action: "rejected",
      reason: "unknown-match",
      matchId: parsed.matchId,
      userId: interaction.userId
    };
  }

  const parsedScore = parseScoreInput(interaction.getTextInputValue(scoreInputCustomId));

  if (!parsedScore.ok) {
    await interaction.reply({
      content: "Use a score like 2x1 or 2-1.",
      ephemeral: true
    });
    return {
      action: "rejected",
      reason: parsedScore.reason,
      matchId: match.id,
      userId: interaction.userId
    };
  }

  const prediction: StoredPrediction = {
    userId: interaction.userId,
    matchId: match.id,
    messageId: interaction.interactionId,
    homeScore: parsedScore.score.homeScore,
    awayScore: parsedScore.score.awayScore,
    submittedAt: interaction.createdAt.toISOString(),
    updatedAt: null,
    parserVersion: modalPredictionParserVersion
  };

  await options.upsertPrediction(prediction);
  await interaction.reply({
    content: `Saved: ${match.homeTeam.name} ${parsedScore.score.normalizedText} ${match.awayTeam.name}`,
    ephemeral: true
  });

  return {
    action: "accepted",
    prediction
  };
}
