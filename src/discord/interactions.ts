import { MessageFlags, type Interaction, type ModalBuilder } from "discord.js";

import {
  awayScoreInputCustomId,
  createPredictionModal,
  decisionMethodSelectCustomId,
  parseDecisionMethod,
  homeScoreInputCustomId,
  parsePredictButtonCustomId,
  parseScoreModalCustomId,
} from "./components.js";
import { formatUserPredictionSummary } from "../predictions/personal-summary.js";
import type { StoredPrediction } from "../storage/database.js";
import {
  canSubmitPredictionAt,
  formatPredictionWindow,
  type PredictionSubmissionWindow
} from "../worldcup/cutoff.js";
import {
  defaultMatchdayRolloverTime,
  getMatchdayDateForMatch
} from "../worldcup/matchday.js";
import { formatTeamName } from "../worldcup/team-display.js";
import type { WorldCupMatch } from "../worldcup/types.js";

export const modalPredictionParserVersion = "prediction-modal-v1";
const defaultTimeZone = "UTC";

export interface PredictionInteractionOptions {
  guildId: string;
  channelId: string;
  matches: WorldCupMatch[];
  timeZone?: string;
  matchdayRolloverTime?: string;
  now?(): Date;
  listPredictions(): StoredPrediction[];
  upsertPrediction(prediction: StoredPrediction): void | Promise<void>;
  logPredictionInteraction?(result: PredictionInteractionResult): void;
}

export type PredictionInteraction = PredictionButtonInteraction | PredictionModalSubmitInteraction;

export interface PredictionButtonInteraction {
  kind: "button";
  customId: string;
  guildId: string | null;
  channelId: string;
  userId: string;
  createdAt?: Date;
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
  getStringSelectValues?(customId: string): readonly string[];
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
      reason: "unknown-match" | "invalid-score-format" | "invalid-decision-method" | "missing-kickoff";
      matchId: string;
      userId: string;
    }
  | {
      action: "rejected";
      reason: "closed";
      closesAtUtc: string;
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
    return handlePredictButton(interaction, matchesById, options);
  }

  return handleScoreModal(interaction, matchesById, options);
}

export async function handleDiscordPredictionInteraction(
  interaction: Interaction,
  options: PredictionInteractionOptions
): Promise<PredictionInteractionResult> {
  if (!interaction.channelId) {
    return logPredictionResult(options, { action: "ignored", reason: "wrong-channel" });
  }

  if (interaction.isButton()) {
    const result = await handlePredictionInteraction(
      {
        kind: "button",
        customId: interaction.customId,
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        userId: interaction.user.id,
        createdAt: interaction.createdAt,
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

    return logPredictionResult(options, result);
  }

  if (interaction.isModalSubmit()) {
    const result = await handlePredictionInteraction(
      {
        kind: "modal-submit",
        customId: interaction.customId,
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        userId: interaction.user.id,
        interactionId: interaction.id,
        createdAt: interaction.createdAt,
        getTextInputValue: (customId) => interaction.fields.getTextInputValue(customId),
        getStringSelectValues: (customId) => interaction.fields.getStringSelectValues(customId),
        reply: async (reply) => {
          await interaction.reply({
            content: reply.content,
            flags: MessageFlags.Ephemeral
          });
        }
      },
      options
    );

    return logPredictionResult(options, result);
  }

  return logPredictionResult(options, {
    action: "ignored",
    reason: "unsupported-interaction"
  });
}

function logPredictionResult(
  options: PredictionInteractionOptions,
  result: PredictionInteractionResult
): PredictionInteractionResult {
  options.logPredictionInteraction?.(result);

  return result;
}

async function handlePredictButton(
  interaction: PredictionButtonInteraction,
  matchesById: Map<string, WorldCupMatch>,
  options: PredictionInteractionOptions
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

  const submissionWindow = canSubmitPredictionAt(match, interactionTime(interaction, options));

  if (!submissionWindow.ok) {
    return rejectForPredictionWindow(interaction, match, submissionWindow, options);
  }

  await interaction.showModal(
    createPredictionModal(match, findExistingPrediction(options, interaction.userId, match.id))
  );

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

  const submissionWindow = canSubmitPredictionAt(match, interactionTime(interaction, options));

  if (!submissionWindow.ok) {
    return rejectForPredictionWindow(interaction, match, submissionWindow, options);
  }

  const parsedScore = parseScoreFields(
    interaction.getTextInputValue(homeScoreInputCustomId),
    interaction.getTextInputValue(awayScoreInputCustomId)
  );

  if (!parsedScore.ok) {
    await interaction.reply({
      content: "Use apenas números nos dois campos do placar.",
      ephemeral: true
    });
    return {
      action: "rejected",
      reason: parsedScore.reason,
      matchId: match.id,
      userId: interaction.userId
    };
  }

  const parsedDecisionMethod = parsePredictionDecisionMethod(interaction, match);

  if (!parsedDecisionMethod.ok) {
    await interaction.reply({
      content: "Selecione como a partida será decidida.",
      ephemeral: true
    });
    return {
      action: "rejected",
      reason: parsedDecisionMethod.reason,
      matchId: match.id,
      userId: interaction.userId
    };
  }

  const existingPrediction = findExistingPrediction(options, interaction.userId, match.id);
  const prediction: StoredPrediction = {
    userId: interaction.userId,
    matchId: match.id,
    messageId: interaction.interactionId,
    homeScore: parsedScore.score.homeScore,
    awayScore: parsedScore.score.awayScore,
    ...(parsedDecisionMethod.decisionMethod
      ? { decisionMethod: parsedDecisionMethod.decisionMethod }
      : {}),
    submittedAt: existingPrediction?.submittedAt ?? interaction.createdAt.toISOString(),
    updatedAt: existingPrediction ? interaction.createdAt.toISOString() : null,
    parserVersion: modalPredictionParserVersion
  };

  await options.upsertPrediction(prediction);
  await interaction.reply({
    content: [
      `Palpite salvo: ${formatTeamName(match.homeTeam)} ${
        parsedScore.score.normalizedText
      } ${formatTeamName(match.awayTeam)}`,
      "",
      formatUserPredictionSummary({
        userId: interaction.userId,
        date: getMatchdayDateForMatch(
          match,
          options.timeZone ?? defaultTimeZone,
          options.matchdayRolloverTime ?? defaultMatchdayRolloverTime
        ),
        matches: options.matches,
        predictions: withAcceptedPrediction(options.listPredictions(), prediction),
        timeZone: options.timeZone ?? defaultTimeZone,
        matchdayRolloverTime: options.matchdayRolloverTime ?? defaultMatchdayRolloverTime
      })
    ].join("\n"),
    ephemeral: true
  });

  return {
    action: "accepted",
    prediction
  };
}

function parsePredictionDecisionMethod(
  interaction: PredictionModalSubmitInteraction,
  match: WorldCupMatch
):
  | { ok: true; decisionMethod?: ReturnType<typeof parseDecisionMethod> }
  | { ok: false; reason: "invalid-decision-method" } {
  if (match.phase === "group") {
    return { ok: true };
  }

  const [value] = interaction.getStringSelectValues?.(decisionMethodSelectCustomId) ?? [];
  const decisionMethod = value ? parseDecisionMethod(value) : undefined;

  if (!decisionMethod) {
    return { ok: false, reason: "invalid-decision-method" };
  }

  return { ok: true, decisionMethod };
}

function findExistingPrediction(
  options: PredictionInteractionOptions,
  userId: string,
  matchId: string
): StoredPrediction | undefined {
  return options
    .listPredictions()
    .find((prediction) => prediction.userId === userId && prediction.matchId === matchId);
}

function withAcceptedPrediction(
  predictions: readonly StoredPrediction[],
  acceptedPrediction: StoredPrediction
): StoredPrediction[] {
  return [
    ...predictions.filter(
      (prediction) =>
        prediction.userId !== acceptedPrediction.userId ||
        prediction.matchId !== acceptedPrediction.matchId
    ),
    acceptedPrediction
  ];
}

function parseScoreFields(homeInput: string, awayInput: string) {
  if (!/^\d{1,2}$/u.test(homeInput.trim()) || !/^\d{1,2}$/u.test(awayInput.trim())) {
    return { ok: false as const, reason: "invalid-score-format" as const };
  }

  const homeScore = Number.parseInt(homeInput.trim(), 10);
  const awayScore = Number.parseInt(awayInput.trim(), 10);

  return {
    ok: true as const,
    score: {
      homeScore,
      awayScore,
      normalizedText: `${homeScore}-${awayScore}`
    }
  };
}

function interactionTime(
  interaction: PredictionButtonInteraction | PredictionModalSubmitInteraction,
  options: PredictionInteractionOptions
): Date {
  return options.now?.() ?? interaction.createdAt ?? new Date();
}

async function rejectForPredictionWindow(
  interaction: PredictionButtonInteraction | PredictionModalSubmitInteraction,
  match: WorldCupMatch,
  submissionWindow: Extract<PredictionSubmissionWindow, { ok: false }>,
  options: PredictionInteractionOptions
): Promise<PredictionInteractionResult> {
  if (submissionWindow.reason === "missing-kickoff") {
    await interaction.reply({
      content: "Predictions are not open yet because this match kickoff is not verified.",
      ephemeral: true
    });

    return {
      action: "rejected",
      reason: "missing-kickoff",
      matchId: match.id,
      userId: interaction.userId
    };
  }

  const predictionWindow = formatPredictionWindow(match, options.timeZone ?? defaultTimeZone);

  await interaction.reply({
    content: `Predictions are closed for this match. ${predictionWindow.closesText}`,
    ephemeral: true
  });

  return {
    action: "rejected",
    reason: "closed",
    closesAtUtc: submissionWindow.closesAtUtc,
    matchId: match.id,
    userId: interaction.userId
  };
}
