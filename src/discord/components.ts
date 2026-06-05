import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} from "discord.js";

import type { WorldCupMatch } from "../worldcup/types.js";
import { formatPredictionWindow } from "../worldcup/cutoff.js";
import { formatTeamName } from "../worldcup/team-display.js";

export const scoreInputCustomId = "score";

const customIdPrefix = "copanalhas";
const predictAction = "predict";
const scoreAction = "score";
const defaultTimeZone = "UTC";

export interface ParsedComponentCustomId {
  matchId: string;
}

export interface MatchCardView {
  matchId: string;
  predictButtonCustomId: string;
  content: string;
}

export interface MatchCardMessage {
  content: string;
  components: ActionRowBuilder<ButtonBuilder>[];
}

export interface MatchCardViewOptions {
  timeZone?: string;
}

export function buildPredictButtonCustomId(matchId: string): string {
  return [customIdPrefix, predictAction, matchId].join(":");
}

export function parsePredictButtonCustomId(customId: string): ParsedComponentCustomId | undefined {
  return parseCustomId(customId, predictAction);
}

export function buildScoreModalCustomId(matchId: string): string {
  return [customIdPrefix, scoreAction, matchId].join(":");
}

export function parseScoreModalCustomId(customId: string): ParsedComponentCustomId | undefined {
  return parseCustomId(customId, scoreAction);
}

export function buildMatchCardView(
  match: WorldCupMatch,
  options: MatchCardViewOptions = {}
): MatchCardView {
  const predictionWindow = formatPredictionWindow(match, options.timeZone ?? defaultTimeZone);
  const homeTeamName = formatTeamName(match.homeTeam);
  const awayTeamName = formatTeamName(match.awayTeam);

  return {
    matchId: match.id,
    predictButtonCustomId: buildPredictButtonCustomId(match.id),
    content: [
      "MATCH OF THE DAY",
      `Match #${match.matchNumber} - Group ${match.group}`,
      `${homeTeamName} vs ${awayTeamName}`,
      predictionWindow.kickoffText,
      predictionWindow.closesText,
      "Click Predict and enter a score like 2x1."
    ].join("\n")
  };
}

export function createMatchCardMessage(
  match: WorldCupMatch,
  options: MatchCardViewOptions = {}
): MatchCardMessage {
  const view = buildMatchCardView(match, options);

  return {
    content: view.content,
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(view.predictButtonCustomId)
          .setLabel("Predict")
          .setStyle(ButtonStyle.Primary)
      )
    ]
  };
}

export function createPredictionModal(match: WorldCupMatch): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(buildScoreModalCustomId(match.id))
    .setTitle(`${formatTeamName(match.homeTeam)} vs ${formatTeamName(match.awayTeam)}`)
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId(scoreInputCustomId)
          .setLabel("Score")
          .setPlaceholder("2x1")
          .setRequired(true)
          .setStyle(TextInputStyle.Short)
      )
    );
}

function parseCustomId(customId: string, expectedAction: string): ParsedComponentCustomId | undefined {
  const [prefix, action, matchId, ...extra] = customId.split(":");

  if (prefix !== customIdPrefix || action !== expectedAction || !matchId || extra.length > 0) {
    return undefined;
  }

  return { matchId };
}
