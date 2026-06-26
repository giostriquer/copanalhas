import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type APILabelComponent,
  ComponentType,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} from "discord.js";

import type { DecisionMethod } from "../scoring/scoring.js";
import type { StoredPrediction } from "../storage/database.js";
import type { WorldCupMatch } from "../worldcup/types.js";
import { formatDiscordTimestamp, formatPredictionWindow, getPredictionWindow } from "../worldcup/cutoff.js";
import { formatTeamName } from "../worldcup/team-display.js";

export const homeScoreInputCustomId = "homeScore";
export const awayScoreInputCustomId = "awayScore";
export const decisionMethodSelectCustomId = "decisionMethod";

export const decisionMethodOptions: readonly {
  value: DecisionMethod;
  label: string;
  shortLabel: string;
}[] = [
  { value: "regular", label: "Tempo regulamentar", shortLabel: "Tempo regulamentar" },
  { value: "extra_time", label: "Prorrogação", shortLabel: "Prorrogação" },
  { value: "penalties", label: "Cobrança de pênaltis", shortLabel: "Pênaltis" }
];

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
  embeds?: EmbedBuilder[];
  components: ActionRowBuilder<ButtonBuilder>[];
}

export interface MatchCardViewOptions {
  timeZone?: string;
}

export interface MatchDayMessageOptions extends MatchCardViewOptions {
  date: string;
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
      `Match #${match.matchNumber} - ${formatMatchStage(match, "single")}`,
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
      new ActionRowBuilder<ButtonBuilder>().addComponents(createPredictButton(match, "Predict"))
    ]
  };
}

export function createMatchDayMessage(
  matches: readonly WorldCupMatch[],
  options: MatchDayMessageOptions
): MatchCardMessage {
  return {
    content: "JOGOS DO DIA",
    embeds: [
      new EmbedBuilder()
        .setColor(0x22a66a)
        .setTitle(formatMatchDayDate(options.date, options.timeZone ?? defaultTimeZone))
        .setDescription("Use os botões abaixo para enviar seu palpite.")
        .addFields(matches.map((match) => formatMatchDayEmbedField(match)))
    ],
    components: chunk(
      matches.map((match) => createPredictButton(match, `Palpite #${match.matchNumber}`)),
      5
    ).map((buttons) => new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons))
  };
}

export function createPredictionModal(
  match: WorldCupMatch,
  existingPrediction?: StoredPrediction
): ModalBuilder {
  return createPredictionModalWithInitialScores(match, existingPrediction);
}

export function createPredictionModalWithInitialScores(
  match: WorldCupMatch,
  existingPrediction?: StoredPrediction
): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId(buildScoreModalCustomId(match.id))
    .setTitle(`${formatTeamName(match.homeTeam)} x ${formatTeamName(match.awayTeam)}`)
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        createScoreTextInput({
          customId: homeScoreInputCustomId,
          label: formatTeamName(match.homeTeam),
          value: existingPrediction?.homeScore
        })
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        createScoreTextInput({
          customId: awayScoreInputCustomId,
          label: formatTeamName(match.awayTeam),
          value: existingPrediction?.awayScore
        })
      )
    );

  if (match.phase !== "group") {
    modal.addComponents(createDecisionMethodLabel(existingPrediction?.decisionMethod ?? null));
  }

  return modal;
}

export function parseDecisionMethod(value: string): DecisionMethod | undefined {
  return decisionMethodOptions.find((option) => option.value === value)?.value;
}

export function formatDecisionMethodLabel(value: DecisionMethod): string {
  return decisionMethodOptions.find((option) => option.value === value)?.shortLabel ?? value;
}

function parseCustomId(customId: string, expectedAction: string): ParsedComponentCustomId | undefined {
  const [prefix, action, matchId, ...extra] = customId.split(":");

  if (prefix !== customIdPrefix || action !== expectedAction || !matchId || extra.length > 0) {
    return undefined;
  }

  return { matchId };
}

function formatMatchDaySection(match: WorldCupMatch, options: MatchCardViewOptions): string[] {
  const predictionWindow = formatPredictionWindow(match, options.timeZone ?? defaultTimeZone);

  return [
    `Match #${match.matchNumber} - ${formatMatchStage(match, "single")}`,
    `${formatTeamName(match.homeTeam)} vs ${formatTeamName(match.awayTeam)}`,
    predictionWindow.kickoffText,
    predictionWindow.closesText
  ];
}

function formatMatchDayEmbedField(match: WorldCupMatch) {
  const predictionWindow = getPredictionWindow(match);

  return {
    name: `#${match.matchNumber} · ${formatMatchStage(match, "embed")}`,
    value: [
      `${formatTeamName(match.homeTeam)} x ${formatTeamName(match.awayTeam)}`,
      predictionWindow.kickoffAtUtc
        ? `Partida: ${formatDiscordTimestamp(predictionWindow.kickoffAtUtc, "t")} (${formatDiscordTimestamp(
            predictionWindow.kickoffAtUtc,
            "R"
          )})`
        : "Partida: horário não verificado",
      predictionWindow.closesAtUtc
        ? `Apostas encerram: ${formatDiscordTimestamp(predictionWindow.closesAtUtc, "t")}`
        : "Apostas encerram: indisponível"
    ].join("\n"),
    inline: true
  };
}

function formatMatchStage(match: WorldCupMatch, mode: "single" | "embed"): string {
  if (match.phase === "group") {
    return mode === "single" ? `Group ${match.group}` : `Grupo ${match.group}`;
  }

  return knockoutPhaseLabel(match.phase);
}

function knockoutPhaseLabel(phase: WorldCupMatch["phase"]): string {
  switch (phase) {
    case "round_of_32":
      return "Rodada de 32";
    case "round_of_16":
      return "Oitavas";
    case "quarter_final":
      return "Quartas";
    case "semi_final":
      return "Semifinal";
    case "third_place":
      return "Decisão do 3º lugar";
    case "final":
      return "Final";
    case "group":
      return "Grupo";
  }
}

function formatMatchDayDate(date: string, timeZone: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone
  }).format(new Date(`${date}T12:00:00.000Z`));
}

function createScoreTextInput(options: {
  customId: string;
  label: string;
  value?: number | undefined;
}): TextInputBuilder {
  const input = new TextInputBuilder()
    .setCustomId(options.customId)
    .setLabel(options.label)
    .setPlaceholder("0")
    .setRequired(true)
    .setMinLength(1)
    .setMaxLength(2)
    .setStyle(TextInputStyle.Short);

  if (options.value !== undefined) {
    input.setValue(String(options.value));
  }

  return input;
}

function createDecisionMethodLabel(selectedValue: DecisionMethod | null): APILabelComponent {
  return {
    type: ComponentType.Label,
    label: "Como a partida será decidida?",
    component: {
      type: ComponentType.StringSelect,
      custom_id: decisionMethodSelectCustomId,
      placeholder: "Escolha uma opção",
      required: true,
      min_values: 1,
      max_values: 1,
      options: decisionMethodOptions.map((option) => ({
        label: option.label,
        value: option.value,
        default: selectedValue === option.value
      }))
    }
  };
}

function createPredictButton(match: WorldCupMatch, label: string): ButtonBuilder {
  return new ButtonBuilder()
    .setCustomId(buildPredictButtonCustomId(match.id))
    .setLabel(label)
    .setStyle(ButtonStyle.Primary);
}

function chunk<T>(values: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}
