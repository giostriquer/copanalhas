import { MessageFlags, type ChatInputCommandInteraction, type Interaction } from "discord.js";

import type { PostDueMatchCardsResult } from "../app/match-card-posting.js";
import { formatOperatorHealthReport, type OperatorHealthSnapshot } from "../app/operator-health.js";
import { formatLeaderboard } from "../leaderboard/format.js";
import { formatUserPredictionSummary } from "../predictions/personal-summary.js";
import { parseScoreInput, type ParsedScoreInput } from "../predictions/score-parser.js";
import { formatPredictionAudit, formatPredictionReveal } from "../predictions/visibility.js";
import {
  buildLeaderboard,
  scoreMatch,
  type DecisionMethod,
  type MatchResult,
  type MatchWinner
} from "../scoring/scoring.js";
import type {
  PostedMatchCardSource,
  StoredBracketPost,
  StoredChaosDashboardPost,
  StoredLeaderboardPost,
  StoredPrediction,
  StoredResult,
  StoredStandingsPost,
  StoredThirdPlacePost
} from "../storage/database.js";
import type { WorldCupMatch } from "../worldcup/types.js";
import {
  getMatchdayDateForInstant,
  getMatchdayDateForMatch,
  isMatchOnMatchday
} from "../worldcup/matchday.js";
import { formatTeamName } from "../worldcup/team-display.js";
import type { UpdateStandingsDashboardResult } from "../app/standings-posting.js";
import type { UpdateLeaderboardDashboardResult } from "../app/leaderboard-posting.js";
import type { UpdateBracketDashboardResult } from "../app/bracket-posting.js";
import type { UpdateThirdPlaceDashboardResult } from "../app/third-place-posting.js";
import type { UpdateChaosDashboardResult } from "../app/chaos-dashboard-posting.js";
import {
  chaosRecapPeriodChoices,
  parseChaosRecapPeriodKey,
  type ChaosRecapPeriodKey
} from "../chaos-dashboard/periods.js";
import type { RepostPredictionRevealResult } from "../app/prediction-reveal-posting.js";
import type { ResultSyncSkippedMatch } from "../results/sync.js";
import { copanalhasCommandName } from "./commands.js";

export type OperatorSubcommand =
  | "post-today"
  | "post-date"
  | "clear-posted-date"
  | "reset-test-date"
  | "status"
  | "standings"
  | "leaderboard"
  | "bracket"
  | "third-places"
  | "copanalhas-recap-painel"
  | "sync-results"
  | "meus-palpites"
  | "predictions"
  | "set-prediction"
  | "reveal"
  | "repost-reveal"
  | "result";

export interface OperatorCommandInput {
  guildId: string | null;
  channelId: string | null;
  userId: string;
  subcommand: OperatorSubcommand;
  options: Record<string, string>;
}

export interface OperatorAutocompleteInput {
  guildId: string | null;
  channelId: string | null;
  userId: string;
  subcommand: OperatorSubcommand;
  focusedOptionName: string;
  focusedValue: string;
}

export interface OperatorCommandOptions {
  guildId: string;
  channelId: string;
  matches: WorldCupMatch[];
  timeZone: string;
  matchdayRolloverTime: string;
  resultSyncEnabled: boolean;
  now(): Date;
  getOperatorHealth?(): OperatorHealthSnapshot;
  getRuntimeStatus?(): RuntimeStatusSnapshot;
  postDueMatchCards(date: string, postSource: PostedMatchCardSource): Promise<PostDueMatchCardsResult>;
  clearPostedMatchCards(date: string): number;
  clearPredictionsForMatches(matchIds: readonly string[]): number;
  clearResultsForMatches(matchIds: readonly string[]): number;
  clearPredictionRevealPostsForMatches(matchIds: readonly string[]): number;
  clearMatchStartAlertsForMatches(matchIds: readonly string[]): number;
  listPredictions(): StoredPrediction[];
  upsertPrediction(prediction: StoredPrediction): void | Promise<void>;
  listResults(): MatchResult[];
  upsertResult(result: StoredResult): void | Promise<void>;
  ownerUserId?: string | null;
  listStandingsPosts(): StoredStandingsPost[];
  updateStandingsDashboard(): Promise<UpdateStandingsDashboardResult>;
  listLeaderboardPosts(): StoredLeaderboardPost[];
  updateLeaderboardDashboard(): Promise<UpdateLeaderboardDashboardResult>;
  listBracketPosts(): StoredBracketPost[];
  updateBracketDashboard(): Promise<UpdateBracketDashboardResult>;
  listThirdPlacePosts(): StoredThirdPlacePost[];
  updateThirdPlaceDashboard(): Promise<UpdateThirdPlaceDashboardResult>;
  listChaosDashboardPosts(): StoredChaosDashboardPost[];
  updateChaosDashboard(
    refreshExisting?: boolean,
    periodKey?: ChaosRecapPeriodKey
  ): Promise<UpdateChaosDashboardResult>;
  syncResultsNow(): Promise<RuntimeResultSyncStatus>;
  repostPredictionReveal(matchId: string): Promise<RepostPredictionRevealResult>;
  updatePredictionResultReveals?(): Promise<unknown>;
  resolveUserDisplayNames?(userIds: readonly string[]): Promise<ReadonlyMap<string, string>>;
  logOperatorCommand?(input: OperatorCommandInput, result: OperatorCommandResult): void;
  logOperatorAutocomplete?(
    input: OperatorAutocompleteInput,
    result: OperatorAutocompleteResult
  ): void;
}

export const operatorSetPredictionParserVersion = "operator-set-prediction-v1";

export type OperatorCommandResult =
  | {
      action: "ignored";
      reason: "wrong-guild" | "wrong-channel" | "unknown-command" | "stale-interaction";
    }
  | { action: "replied"; content: string; ephemeral: boolean };

export type OperatorAutocompleteResult =
  | { action: "ignored"; reason: "wrong-guild" | "wrong-channel" | "unsupported-option" }
  | { action: "responded"; choices: Array<{ name: string; value: string }> };

export type RuntimePredictionState = "open" | "closed" | "missing-kickoff";

export interface RuntimeTodayMatchStatus {
  matchId: string;
  matchNumber: number;
  label: string;
  posted: boolean;
  predictionState: RuntimePredictionState;
}

export type RuntimeAutoPostStatus =
  | { action: "never" }
  | { action: "disabled" }
  | { action: "not-due"; localDate: string; localTime: string }
  | {
      action: "posted";
      localDate: string;
      windowDays: number;
      dates: Array<{ date: string; posted: string[]; skipped: string[] }>;
      posted: string[];
      skipped: string[];
    };

export type RuntimeResultSyncStatus =
  | { action: "never" }
  | { action: "disabled"; reason: "disabled" | "missing-token" }
  | { action: "not-due"; nextCheckAtUtc: string | null; pendingMatchIds: string[] }
  | { action: "failed"; dateFrom: string; dateTo: string; reason: "rate-limited" | "unavailable" }
  | {
      action: "synced";
      dateFrom: string;
      dateTo: string;
      storedResults: string[];
      skipped: string[];
      skippedDetails?: ResultSyncSkippedMatch[];
    };

export interface RuntimeStatusSnapshot {
  localDate: string;
  localTime: string;
  timeZone: string;
  autoPostEnabled: boolean;
  autoPostTime: string;
  autoPostWindowDays: number;
  todayMatches: RuntimeTodayMatchStatus[];
  lastAutoPost: RuntimeAutoPostStatus;
  resultSyncEnabled: boolean;
  lastResultSync: RuntimeResultSyncStatus;
}

export async function handleOperatorCommand(
  command: OperatorCommandInput,
  options: OperatorCommandOptions
): Promise<OperatorCommandResult> {
  if (command.guildId !== options.guildId) {
    return { action: "ignored", reason: "wrong-guild" };
  }

  if (command.channelId !== options.channelId) {
    return { action: "ignored", reason: "wrong-channel" };
  }

  if (command.subcommand === "post-today") {
    const matchdayDate = getMatchdayDateForInstant(
      options.now(),
      options.timeZone,
      options.matchdayRolloverTime
    );
    return postForDate(matchdayDate, options);
  }

  if (command.subcommand === "post-date") {
    const date = command.options.date;

    if (!isDateString(date)) {
      return reply("Use a date like 2026-06-11.");
    }

    return postForDate(date, options);
  }

  if (command.subcommand === "clear-posted-date") {
    const date = command.options.date;

    if (!isDateString(date)) {
      return reply("Use a date like 2026-06-11.");
    }

    const cleared = options.clearPostedMatchCards(date);

    return reply(
      [
        `Cleared ${cleared} ${count(
          cleared,
          "posted match card record",
          "posted match card records"
        )} for ${date}.`,
        "Predictions, results, and standings were not touched."
      ].join("\n")
    );
  }

  if (command.subcommand === "reset-test-date") {
    const date = command.options.date;

    if (!isDateString(date)) {
      return reply("Use a date like 2026-06-11.");
    }

    const selectedMatches = options.matches
      .filter((match) =>
        isMatchOnMatchday(match, date, options.timeZone, options.matchdayRolloverTime)
      )
      .toSorted((left, right) => left.matchNumber - right.matchNumber);
    const matchIds = selectedMatches.map((match) => match.id);
    const refreshGroupDashboards = selectedMatches.some((match) => match.phase === "group");

    const postedCards = options.clearPostedMatchCards(date);
    const predictions = options.clearPredictionsForMatches(matchIds);
    const results = options.clearResultsForMatches(matchIds);
    const predictionReveals = options.clearPredictionRevealPostsForMatches(matchIds);
    const matchStartAlerts = options.clearMatchStartAlertsForMatches(matchIds);

    if (refreshGroupDashboards) {
      await options.updateStandingsDashboard();
    }
    await options.updateLeaderboardDashboard();
    await options.updateBracketDashboard();
    if (refreshGroupDashboards) {
      await options.updateThirdPlaceDashboard();
    }
    await options.updateChaosDashboard(false);

    return reply(
      [
        `Reset test data for ${date}.`,
        `Posted card records: ${postedCards}`,
        `Predictions: ${predictions}`,
        `Results: ${results}`,
        `Prediction reveals: ${predictionReveals}`,
        `Match start alerts: ${matchStartAlerts}`,
        ...(refreshGroupDashboards ? ["Standings refreshed."] : []),
        "Leaderboard refreshed.",
        "Bracket refreshed.",
        ...(refreshGroupDashboards ? ["Third-place dashboard refreshed."] : []),
        "Copanalhas Recap refreshed."
      ].join("\n")
    );
  }

  if (command.subcommand === "status") {
    const operatorHealth = options.getOperatorHealth?.();

    if (operatorHealth) {
      return reply(formatOperatorHealthReport(operatorHealth).join("\n"));
    }

    const runtimeStatus = options.getRuntimeStatus?.();

    return reply(
      [
        "Copanalhas Status",
        ...formatRuntimeStatus(runtimeStatus),
        `Matches loaded: ${options.matches.length}`,
        `Missing kickoff times: ${options.matches.filter((match) => !match.kickoffAtUtc).length}`,
        `Result sync: ${
          (runtimeStatus?.resultSyncEnabled ?? options.resultSyncEnabled) ? "on" : "off"
        }`,
        ...formatLastResultSync(runtimeStatus?.lastResultSync),
        ...formatStandingsStatus(options.listStandingsPosts(), options.guildId, options.channelId),
        ...formatLeaderboardStatus(
          options.listLeaderboardPosts(),
          options.guildId,
          options.channelId
        ),
        ...formatBracketStatus(options.listBracketPosts(), options.guildId, options.channelId),
        ...formatThirdPlaceStatus(
          options.listThirdPlacePosts(),
          options.guildId,
          options.channelId
        ),
        ...formatChaosDashboardStatus(
          options.listChaosDashboardPosts(),
          options.guildId,
          options.channelId
        )
      ].join("\n")
    );
  }

  if (command.subcommand === "standings") {
    const result = await options.updateStandingsDashboard();

    return reply(`Updated standings dashboard: ${result.posts.length} posts.`);
  }

  if (command.subcommand === "leaderboard") {
    const predictions = options.listPredictions();
    const scoredPredictions = options
      .listResults()
      .flatMap((result) => scoreMatch(result, predictions));
    const rows = buildLeaderboard(scoredPredictions, predictions);
    const displayNames = await resolveLeaderboardDisplayNames(
      options,
      rows.map((row) => row.userId)
    );

    return reply(formatLeaderboard(rows, displayNames));
  }

  if (command.subcommand === "bracket") {
    try {
      const result = await options.updateBracketDashboard();

      return reply(
        `Updated bracket dashboard: ${result.post.action} (${result.bracketPhase}, ${result.renderState}).`
      );
    } catch (error) {
      return reply(`Failed to update bracket dashboard: ${errorMessage(error)}.`);
    }
  }

  if (command.subcommand === "third-places") {
    try {
      const result = await options.updateThirdPlaceDashboard();

      return reply(
        `Updated third-place dashboard: ${result.post.action} (${result.qualificationStatus}, ${result.renderState}).`
      );
    } catch (error) {
      return reply(`Failed to update third-place dashboard: ${errorMessage(error)}.`);
    }
  }

  if (command.subcommand === "copanalhas-recap-painel") {
    const periodKey = parseChaosRecapPeriodKey(command.options.period);

    if (command.options.period && !periodKey) {
      return reply(
        `Unknown Copanalhas Recap period ${command.options.period}. Use ${formatChaosRecapPeriodKeys()}.`
      );
    }

    try {
      const result = periodKey
        ? await options.updateChaosDashboard(true, periodKey)
        : await options.updateChaosDashboard();

      return reply(
        `Updated Copanalhas Recap${formatChaosRecapPeriodSuffix(periodKey)}: ${formatChaosRecapUpdateSummary(result)}.`
      );
    } catch (error) {
      return reply(`Failed to update Copanalhas Recap: ${errorMessage(error)}.`);
    }
  }

  if (command.subcommand === "sync-results") {
    return reply(formatSyncResultsNowReply(await options.syncResultsNow()));
  }

  if (command.subcommand === "meus-palpites") {
    const date =
      command.options.date ||
      getMatchdayDateForInstant(options.now(), options.timeZone, options.matchdayRolloverTime);

    if (!isDateString(date)) {
      return reply("Use a date like 2026-06-11.");
    }

    return reply(
      formatUserPredictionSummary({
        userId: command.userId,
        date,
        matches: options.matches,
        predictions: options.listPredictions(),
        timeZone: options.timeZone,
        matchdayRolloverTime: options.matchdayRolloverTime
      })
    );
  }

  if (command.subcommand === "predictions") {
    const match = matchFromCommand(command, options);

    if (!match) {
      return reply(`Unknown match ${command.options.match}.`);
    }

    return reply(
      formatPredictionAudit({
        match,
        predictions: options.listPredictions(),
        now: options.now()
      })
    );
  }

  if (command.subcommand === "set-prediction") {
    if (!options.ownerUserId) {
      return reply("Configure COPANALHAS_OWNER_USER_ID before using set-prediction.");
    }

    if (command.userId !== options.ownerUserId) {
      return reply("Only the configured Copanalhas owner can use set-prediction.");
    }

    const match = matchFromCommand(command, options);

    if (!match) {
      return reply(`Unknown match ${command.options.match}.`);
    }

    const targetUserId = command.options.user?.trim();

    if (!targetUserId) {
      return reply("Choose a Discord user for set-prediction.");
    }

    const parsedScore = parseScoreInput(command.options.score ?? "");

    if (!parsedScore.ok) {
      return reply("Use a score like 2x1 or 2-1.");
    }

    const parsedDecision = parseOperatorPredictionDecision(match, command.options);

    if (!parsedDecision.ok) {
      return reply(parsedDecision.message);
    }

    const recordedAt = options.now().toISOString();
    const existingPrediction = options
      .listPredictions()
      .find((prediction) => prediction.userId === targetUserId && prediction.matchId === match.id);
    const prediction: StoredPrediction = {
      userId: targetUserId,
      matchId: match.id,
      messageId: `operator:${command.userId}:${recordedAt}`,
      homeScore: parsedScore.score.homeScore,
      awayScore: parsedScore.score.awayScore,
      ...(parsedDecision.decisionMethod ? { decisionMethod: parsedDecision.decisionMethod } : {}),
      submittedAt: existingPrediction?.submittedAt ?? recordedAt,
      updatedAt: existingPrediction ? recordedAt : null,
      parserVersion: operatorSetPredictionParserVersion
    };

    await options.upsertPrediction(prediction);

    return reply(
      formatSetPredictionReply({
        match,
        targetUserId,
        prediction,
        reason: cleanOptionalReason(command.options.reason)
      })
    );
  }

  if (command.subcommand === "reveal") {
    const match = matchFromCommand(command, options);

    if (!match) {
      return reply(`Unknown match ${command.options.match}.`);
    }

    const reveal = formatPredictionReveal({
      match,
      predictions: options.listPredictions(),
      now: options.now()
    });

    return reply(reveal.content, !reveal.ok);
  }

  if (command.subcommand === "repost-reveal") {
    const match = matchFromCommand(command, options);

    if (!match) {
      return reply(`Unknown match ${command.options.match}.`);
    }

    return reply(
      formatRepostPredictionRevealReply(match, await options.repostPredictionReveal(match.id))
    );
  }

  if (command.subcommand === "result") {
    const matchId = command.options.match;
    const match = options.matches.find((candidate) => candidate.id === matchId);

    if (!match) {
      return reply(`Unknown match ${matchId}.`);
    }

    const parsedScore = parseScoreInput(command.options.score ?? "");

    if (!parsedScore.ok) {
      return reply("Use a score like 2x1 or 2-1.");
    }

    const manualResult = parseManualResult(match, command.options, parsedScore.score, options.now().toISOString());

    if (!manualResult.ok) {
      return reply(manualResult.message);
    }

    await options.upsertResult(manualResult.result);
    const refreshGroupDashboards = match.phase === "group";

    if (refreshGroupDashboards) {
      await options.updateStandingsDashboard();
    }
    await options.updateLeaderboardDashboard();
    await options.updateBracketDashboard();
    if (refreshGroupDashboards) {
      await options.updateThirdPlaceDashboard();
    }
    await options.updateChaosDashboard(false);
    await options.updatePredictionResultReveals?.();

    return reply(`Recorded result ${match.id} ${parsedScore.score.normalizedText}.`);
  }

  return { action: "ignored", reason: "unknown-command" };
}

export function handleOperatorAutocomplete(
  interaction: OperatorAutocompleteInput,
  options: OperatorCommandOptions
): OperatorAutocompleteResult {
  if (interaction.guildId !== options.guildId) {
    return { action: "ignored", reason: "wrong-guild" };
  }

  if (interaction.channelId !== options.channelId) {
    return { action: "ignored", reason: "wrong-channel" };
  }

  if (
    interaction.focusedOptionName !== "match" ||
    !["predictions", "set-prediction", "reveal", "repost-reveal", "result"].includes(
      interaction.subcommand
    )
  ) {
    return { action: "ignored", reason: "unsupported-option" };
  }

  const query = normalizeSearchText(interaction.focusedValue);
  const choices = options.matches
    .filter((match) => query === "" || normalizeSearchText(matchChoiceSearchText(match, options)).includes(query))
    .toSorted((left, right) => left.matchNumber - right.matchNumber)
    .slice(0, 25)
    .map((match) => ({
      name: matchChoiceName(match, options),
      value: match.id
    }));

  return { action: "responded", choices };
}

export async function handleDiscordOperatorCommand(
  interaction: Interaction,
  options: OperatorCommandOptions
): Promise<OperatorCommandResult> {
  if (!interaction.isChatInputCommand() || interaction.commandName !== copanalhasCommandName) {
    return { action: "ignored", reason: "unknown-command" };
  }

  if (interaction.guildId !== options.guildId) {
    return { action: "ignored", reason: "wrong-guild" };
  }

  if (interaction.channelId !== options.channelId) {
    return { action: "ignored", reason: "wrong-channel" };
  }

  const subcommand = parseOperatorSubcommand(interaction.options.getSubcommand(true));

  if (!subcommand) {
    return { action: "ignored", reason: "unknown-command" };
  }

  const commandInput: OperatorCommandInput = {
    guildId: interaction.guildId,
    channelId: interaction.channelId,
    userId: interaction.user.id,
    subcommand,
    options: readCommandOptions(subcommand, interaction)
  };
  const shouldDeferPrivately = subcommand !== "reveal";

  if (shouldDeferPrivately) {
    try {
      await interaction.deferReply({
        flags: MessageFlags.Ephemeral
      });
    } catch (error) {
      if (!isUnknownInteractionError(error)) {
        throw error;
      }

      const result: OperatorCommandResult = { action: "ignored", reason: "stale-interaction" };
      options.logOperatorCommand?.(commandInput, result);

      return result;
    }
  }

  const result = await handleOperatorCommand(commandInput, options);

  options.logOperatorCommand?.(commandInput, result);

  if (result.action === "replied") {
    if (shouldDeferPrivately) {
      await interaction.editReply({
        content: result.content,
        allowedMentions: { parse: [] }
      });
    } else if (result.ephemeral) {
      await interaction.reply({
        content: result.content,
        flags: MessageFlags.Ephemeral
      });
    } else {
      await interaction.reply({
        content: result.content,
        allowedMentions: { parse: [] }
      });
    }
  }

  return result;
}

export async function handleDiscordOperatorAutocomplete(
  interaction: Interaction,
  options: OperatorCommandOptions
): Promise<OperatorAutocompleteResult> {
  if (!interaction.isAutocomplete() || interaction.commandName !== copanalhasCommandName) {
    return { action: "ignored", reason: "unsupported-option" };
  }

  if (interaction.guildId !== options.guildId) {
    return { action: "ignored", reason: "wrong-guild" };
  }

  if (interaction.channelId !== options.channelId) {
    return { action: "ignored", reason: "wrong-channel" };
  }

  const subcommand = parseOperatorSubcommand(interaction.options.getSubcommand(true));

  if (!subcommand) {
    return { action: "ignored", reason: "unsupported-option" };
  }

  const focused = interaction.options.getFocused(true);
  const autocompleteInput: OperatorAutocompleteInput = {
    guildId: interaction.guildId,
    channelId: interaction.channelId,
    userId: interaction.user.id,
    subcommand,
    focusedOptionName: focused.name,
    focusedValue: String(focused.value)
  };
  const result = handleOperatorAutocomplete(autocompleteInput, options);

  options.logOperatorAutocomplete?.(autocompleteInput, result);

  if (result.action === "responded") {
    await interaction.respond(result.choices);
  }

  return result;
}

async function postForDate(
  date: string,
  options: OperatorCommandOptions
): Promise<OperatorCommandResult> {
  const result = await options.postDueMatchCards(date, "command");
  const matchdayCardCount = result.posted.length > 0 ? 1 : 0;

  return reply(
    `Posted ${matchdayCardCount} ${count(
      matchdayCardCount,
      "matchday card",
      "matchday cards"
    )} for ${result.posted.length} ${count(
      result.posted.length,
      "match",
      "matches"
    )} on ${date}. Skipped ${result.skipped.length} already posted.`
  );
}

function readCommandOptions(
  subcommand: OperatorSubcommand,
  interaction: ChatInputCommandInteraction
): Record<string, string> {
  if (
    subcommand === "post-date" ||
    subcommand === "clear-posted-date" ||
    subcommand === "reset-test-date"
  ) {
    return {
      date: interaction.options.getString("date", true)
    };
  }

  if (subcommand === "meus-palpites") {
    const date = interaction.options.getString("date", false);

    return date ? { date } : {};
  }

  if (subcommand === "copanalhas-recap-painel") {
    const period = interaction.options.getString("period", false);

    return period ? { period } : {};
  }

  if (subcommand === "predictions" || subcommand === "reveal" || subcommand === "repost-reveal") {
    return {
      match: interaction.options.getString("match", true)
    };
  }

  if (subcommand === "set-prediction") {
    return removeUndefinedValues({
      match: interaction.options.getString("match", true),
      user: interaction.options.getUser("user", true).id,
      score: interaction.options.getString("score", true),
      decision: interaction.options.getString("decision", false) ?? undefined,
      reason: interaction.options.getString("reason", false) ?? undefined
    });
  }

  if (subcommand === "result") {
    return removeUndefinedValues({
      match: interaction.options.getString("match", true),
      score: interaction.options.getString("score", true),
      decision: interaction.options.getString("decision", false) ?? undefined,
      "regular-score": interaction.options.getString("regular-score", false) ?? undefined,
      "extra-score": interaction.options.getString("extra-score", false) ?? undefined,
      "penalties-score": interaction.options.getString("penalties-score", false) ?? undefined,
      winner: interaction.options.getString("winner", false) ?? undefined
    });
  }

  return {};
}

function parseOperatorPredictionDecision(
  match: WorldCupMatch,
  options: Record<string, string>
): { ok: true; decisionMethod?: DecisionMethod } | { ok: false; message: string } {
  if (match.phase === "group") {
    return { ok: true };
  }

  const decisionMethod = parseDecisionMethodOption(options.decision ?? "");

  if (!decisionMethod) {
    return {
      ok: false,
      message: "Use decision regular, extra_time, or penalties for knockout predictions."
    };
  }

  return { ok: true, decisionMethod };
}

function formatSetPredictionReply(input: {
  match: WorldCupMatch;
  targetUserId: string;
  prediction: StoredPrediction;
  reason: string | undefined;
}): string {
  const matchLabel = `#${input.match.matchNumber} ${formatTeamName(
    input.match.homeTeam
  )} x ${formatTeamName(input.match.awayTeam)}`;
  const decisionSuffix = input.prediction.decisionMethod
    ? ` (${formatOperatorPredictionDecisionLabel(input.prediction.decisionMethod)})`
    : "";

  return [
    `Recorded extraordinary prediction for <@${input.targetUserId}> on ${matchLabel}: ${input.prediction.homeScore}x${input.prediction.awayScore}${decisionSuffix}.`,
    input.reason ? `Reason: ${input.reason}` : null,
    `If a locked reveal already exists, run /copanalhas repost-reveal match:${input.match.id} to refresh the public thread.`
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

function formatOperatorPredictionDecisionLabel(value: DecisionMethod): string {
  if (value === "regular") {
    return "Tempo regulamentar";
  }

  if (value === "extra_time") {
    return "Prorrogação";
  }

  return "Cobrança de pênaltis";
}

function cleanOptionalReason(value: string | undefined): string | undefined {
  const trimmed = value?.trim();

  return trimmed === "" ? undefined : trimmed;
}

function parseManualResult(
  match: WorldCupMatch,
  options: Record<string, string>,
  finalScore: ParsedScoreInput,
  recordedAt: string
): { ok: true; result: StoredResult } | { ok: false; message: string } {
  const baseResult: StoredResult = {
    matchId: match.id,
    homeScore: finalScore.homeScore,
    awayScore: finalScore.awayScore,
    recordedAt,
    resultSource: "manual",
    externalMatchId: null,
    fetchedAt: null
  };

  if (match.phase === "group") {
    return { ok: true, result: baseResult };
  }

  const decisionMethod = parseDecisionMethodOption(options.decision ?? "regular");

  if (!decisionMethod) {
    return { ok: false, message: "Use decision regular, extra_time, or penalties." };
  }

  if (decisionMethod === "regular") {
    const regularScore = parseOptionalScoreOption(options["regular-score"]) ?? finalScore;
    const winner = parseWinnerOption(options.winner) ?? winnerFromScore(regularScore);

    if (!winner) {
      return { ok: false, message: "Use winner home or away for drawn knockout results." };
    }

    return {
      ok: true,
      result: {
        ...baseResult,
        decisionMethod,
        regularTimeHomeScore: regularScore.homeScore,
        regularTimeAwayScore: regularScore.awayScore,
        winner
      }
    };
  }

  const regularScore = parseRequiredScoreOption(options["regular-score"], "regular-score");

  if (!regularScore.ok) {
    return regularScore;
  }

  const extraScore = parseRequiredScoreOption(options["extra-score"], "extra-score");

  if (!extraScore.ok) {
    return extraScore;
  }

  if (decisionMethod === "extra_time") {
    const winner = parseWinnerOption(options.winner) ?? winnerFromScore(extraScore.score);

    if (!winner) {
      return { ok: false, message: "Use winner home or away for drawn knockout results." };
    }

    return {
      ok: true,
      result: {
        ...baseResult,
        decisionMethod,
        regularTimeHomeScore: regularScore.score.homeScore,
        regularTimeAwayScore: regularScore.score.awayScore,
        extraTimeHomeScore: extraScore.score.homeScore,
        extraTimeAwayScore: extraScore.score.awayScore,
        winner
      }
    };
  }

  const penaltiesScore = parseRequiredScoreOption(options["penalties-score"], "penalties-score");

  if (!penaltiesScore.ok) {
    return penaltiesScore;
  }

  const winner = parseWinnerOption(options.winner) ?? winnerFromScore(penaltiesScore.score);

  if (!winner) {
    return { ok: false, message: "Use winner home or away for drawn knockout results." };
  }

  return {
    ok: true,
    result: {
      ...baseResult,
      decisionMethod,
      regularTimeHomeScore: regularScore.score.homeScore,
      regularTimeAwayScore: regularScore.score.awayScore,
      extraTimeHomeScore: extraScore.score.homeScore,
      extraTimeAwayScore: extraScore.score.awayScore,
      penaltyHomeScore: penaltiesScore.score.homeScore,
      penaltyAwayScore: penaltiesScore.score.awayScore,
      winner
    }
  };
}

function parseDecisionMethodOption(value: string): DecisionMethod | undefined {
  if (value === "regular" || value === "extra_time" || value === "penalties") {
    return value;
  }

  return undefined;
}

function parseWinnerOption(value: string | undefined): MatchWinner | undefined {
  if (value === "home" || value === "away") {
    return value;
  }

  return undefined;
}

function parseOptionalScoreOption(value: string | undefined): ParsedScoreInput | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = parseScoreInput(value);

  return parsed.ok ? parsed.score : undefined;
}

function parseRequiredScoreOption(
  value: string | undefined,
  optionName: string
): { ok: true; score: ParsedScoreInput } | { ok: false; message: string } {
  const parsed = parseScoreInput(value ?? "");

  if (!parsed.ok) {
    return { ok: false, message: `Use ${optionName} like 1-1.` };
  }

  return { ok: true, score: parsed.score };
}

function winnerFromScore(score: Pick<ParsedScoreInput, "homeScore" | "awayScore">): MatchWinner | undefined {
  if (score.homeScore > score.awayScore) {
    return "home";
  }

  if (score.awayScore > score.homeScore) {
    return "away";
  }

  return undefined;
}

function removeUndefinedValues(values: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(values).filter((entry): entry is [string, string] => entry[1] !== undefined)
  );
}

function parseOperatorSubcommand(value: string): OperatorSubcommand | undefined {
  if (
    value === "post-today" ||
    value === "post-date" ||
    value === "clear-posted-date" ||
    value === "reset-test-date" ||
    value === "status" ||
    value === "standings" ||
    value === "leaderboard" ||
    value === "bracket" ||
    value === "third-places" ||
    value === "copanalhas-recap-painel" ||
    value === "sync-results" ||
    value === "meus-palpites" ||
    value === "predictions" ||
    value === "set-prediction" ||
    value === "reveal" ||
    value === "repost-reveal" ||
    value === "result"
  ) {
    return value;
  }

  return undefined;
}

function matchChoiceName(
  match: WorldCupMatch,
  options: Pick<OperatorCommandOptions, "timeZone" | "matchdayRolloverTime">
): string {
  return `#${match.matchNumber} · ${formatTeamName(match.homeTeam)} x ${formatTeamName(
    match.awayTeam
  )} · ${getMatchdayDateForMatch(match, options.timeZone, options.matchdayRolloverTime)} ${
    match.kickoffTimeLocal ?? "horário indefinido"
  }`;
}

function matchChoiceSearchText(
  match: WorldCupMatch,
  options: Pick<OperatorCommandOptions, "timeZone" | "matchdayRolloverTime">
): string {
  return [
    match.id,
    match.matchNumber.toString(),
    match.homeTeam.code,
    match.homeTeam.name,
    formatTeamName(match.homeTeam),
    match.awayTeam.code,
    match.awayTeam.name,
    formatTeamName(match.awayTeam),
    match.localDate,
    getMatchdayDateForMatch(match, options.timeZone, options.matchdayRolloverTime)
  ].join(" ");
}

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function reply(content: string, ephemeral = true): OperatorCommandResult {
  return {
    action: "replied",
    content,
    ephemeral
  };
}

function formatRepostPredictionRevealReply(
  match: WorldCupMatch,
  result: RepostPredictionRevealResult
): string {
  const matchLabel = `#${match.matchNumber} ${formatTeamName(match.homeTeam)} x ${formatTeamName(
    match.awayTeam
  )}`;

  if (result.posted.length === 0) {
    return [
      `No prediction reveal was reposted for ${matchLabel}.`,
      `Cleared reveal records: ${result.cleared}`,
      `Skipped matches: ${result.skipped.length > 0 ? result.skipped.join(",") : "none"}`,
      "Make sure the match card exists and predictions are already closed."
    ].join("\n");
  }

  return [
    `Reposted prediction reveal for ${matchLabel}.`,
    `Cleared reveal records: ${result.cleared}`,
    `Reposted matches: ${result.repostedMatchIds.join(",")}`
  ].join("\n");
}

function isUnknownInteractionError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 10062
  );
}

async function resolveLeaderboardDisplayNames(
  options: Pick<OperatorCommandOptions, "resolveUserDisplayNames">,
  userIds: readonly string[]
): Promise<ReadonlyMap<string, string>> {
  if (!options.resolveUserDisplayNames || userIds.length === 0) {
    return new Map();
  }

  try {
    return await options.resolveUserDisplayNames(userIds);
  } catch {
    return new Map();
  }
}

function matchFromCommand(
  command: OperatorCommandInput,
  options: OperatorCommandOptions
): WorldCupMatch | undefined {
  return options.matches.find((candidate) => candidate.id === command.options.match);
}

function isDateString(value: string | undefined): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/u.test(value);
}

function count(value: number, singular: string, plural: string): string {
  return value === 1 ? singular : plural;
}

function formatStandingsStatus(
  posts: StoredStandingsPost[],
  guildId: string,
  channelId: string
): string[] {
  const matchingPosts = posts.filter(
    (post) => post.guildId === guildId && post.channelId === channelId
  );
  const latestUpdatedAt = matchingPosts
    .map((post) => post.updatedAt)
    .sort()
    .at(-1);

  return [
    `Standings posts: ${matchingPosts.length}/2`,
    `Standings last updated: ${latestUpdatedAt ?? "never"}`
  ];
}

function formatLeaderboardStatus(
  posts: StoredLeaderboardPost[],
  guildId: string,
  channelId: string
): string[] {
  const matchingPost = posts.find(
    (post) => post.guildId === guildId && post.channelId === channelId
  );

  return [
    `Leaderboard post: ${matchingPost ? "present" : "missing"}`,
    `Leaderboard last updated: ${matchingPost?.updatedAt ?? "never"}`
  ];
}

function formatBracketStatus(
  posts: StoredBracketPost[],
  guildId: string,
  channelId: string
): string[] {
  const matchingPost = posts.find(
    (post) => post.guildId === guildId && post.channelId === channelId
  );

  return [
    `Bracket post: ${matchingPost ? "present" : "missing"}`,
    `Bracket last updated: ${matchingPost?.updatedAt ?? "never"}`
  ];
}

function formatThirdPlaceStatus(
  posts: StoredThirdPlacePost[],
  guildId: string,
  channelId: string
): string[] {
  const matchingPost = posts.find(
    (post) => post.guildId === guildId && post.channelId === channelId
  );

  return [
    `Third-place post: ${matchingPost ? "present" : "missing"}`,
    `Third-place last updated: ${matchingPost?.updatedAt ?? "never"}`
  ];
}

function formatChaosRecapUpdateSummary(result: UpdateChaosDashboardResult): string {
  const posted = result.posted.filter((post) => post.action === "posted").length;
  const edited = result.posted.filter((post) => post.action === "edited").length;
  const replaced = result.posted.filter((post) => post.action === "replaced").length;
  const incomplete = result.skipped.filter((period) => period.reason === "incomplete").length;
  const alreadyPosted = result.skipped.filter(
    (period) => period.reason === "already-posted"
  ).length;

  return [
    `${result.posted.length} recaps updated`,
    `posted=${posted}`,
    `edited=${edited}`,
    `replaced=${replaced}`,
    `incomplete=${incomplete}`,
    `alreadyPosted=${alreadyPosted}`
  ].join(" ");
}

function formatChaosRecapPeriodSuffix(periodKey: ChaosRecapPeriodKey | undefined): string {
  if (!periodKey) {
    return "";
  }

  const label = chaosRecapPeriodChoices.find((period) => period.key === periodKey)?.label ?? periodKey;

  return ` (${label})`;
}

function formatChaosRecapPeriodKeys(): string {
  const keys = chaosRecapPeriodChoices.map((period) => period.key);
  const last = keys.at(-1);
  const first = keys.slice(0, -1);

  if (!last) {
    return "a valid period";
  }

  return `${first.join(", ")}, or ${last}`;
}

function formatChaosDashboardStatus(
  posts: StoredChaosDashboardPost[],
  guildId: string,
  channelId: string
): string[] {
  const matchingPosts = posts.filter(
    (post) => post.guildId === guildId && post.channelId === channelId
  );
  const latestUpdatedAt = matchingPosts
    .map((post) => post.updatedAt)
    .sort()
    .at(-1);
  const periodKeys = matchingPosts.map((post) => post.periodKey).sort();

  return [
    `Copanalhas Recap posts: ${matchingPosts.length}`,
    `Copanalhas Recap periods: ${periodKeys.length > 0 ? periodKeys.join(", ") : "none"}`,
    `Copanalhas Recap last updated: ${latestUpdatedAt ?? "never"}`
  ];
}

function formatRuntimeStatus(status: RuntimeStatusSnapshot | undefined): string[] {
  if (!status) {
    return [];
  }

  const postedToday = status.todayMatches.filter((match) => match.posted).length;
  const unpostedToday = status.todayMatches.filter((match) => !match.posted);
  const openWindows = status.todayMatches.filter((match) => match.predictionState === "open").length;
  const closedWindows = status.todayMatches.filter(
    (match) => match.predictionState === "closed"
  ).length;
  const missingKickoffWindows = status.todayMatches.filter(
    (match) => match.predictionState === "missing-kickoff"
  ).length;

  return [
    `Matchday: ${status.localDate}`,
    `Local time: ${status.localTime} ${status.timeZone}`,
    `Auto-post: ${status.autoPostEnabled ? `on at ${status.autoPostTime}` : "off"} ${
      status.timeZone
    } (${status.autoPostWindowDays} day window)`,
    `Matchday matches: ${status.todayMatches.length}`,
    `Posted matchday: ${postedToday}/${status.todayMatches.length}`,
    `Unposted matchday: ${formatUnpostedMatches(unpostedToday)}`,
    `Prediction windows: ${openWindows} open, ${closedWindows} closed, ${missingKickoffWindows} missing kickoff`,
    `Last auto-post: ${formatLastAutoPost(status.lastAutoPost)}`
  ];
}

function formatUnpostedMatches(matches: RuntimeTodayMatchStatus[]): string {
  if (matches.length === 0) {
    return "none";
  }

  return matches.map((match) => `#${match.matchNumber} ${match.label}`).join("; ");
}

function formatLastAutoPost(status: RuntimeAutoPostStatus): string {
  if (status.action === "never") {
    return "never";
  }

  if (status.action === "disabled") {
    return "disabled";
  }

  if (status.action === "not-due") {
    return `not due at ${status.localDate} ${status.localTime}`;
  }

  return `posted ${status.posted.length}, skipped ${status.skipped.length} across ${status.windowDays} days from ${status.localDate}`;
}

function formatLastResultSync(status: RuntimeResultSyncStatus | undefined): string[] {
  if (!status) {
    return [];
  }

  if (status.action === "never") {
    return ["Last result sync: never"];
  }

  if (status.action === "disabled") {
    return [`Last result sync: disabled (${status.reason})`];
  }

  if (status.action === "not-due") {
    return [
      `Last result sync: waiting for ${status.pendingMatchIds.length} pending match${
        status.pendingMatchIds.length === 1 ? "" : "es"
      }${status.nextCheckAtUtc ? `; next check ${status.nextCheckAtUtc}` : ""}`
    ];
  }

  if (status.action === "failed") {
    return [`Last result sync: failed ${status.reason} (${status.dateFrom} to ${status.dateTo})`];
  }

  return [
    `Last result sync: synced ${status.storedResults.length}, skipped ${status.skipped.length} (${status.dateFrom} to ${status.dateTo})`
  ];
}

function formatSyncResultsNowReply(status: RuntimeResultSyncStatus): string {
  if (status.action === "disabled") {
    return `Result sync is disabled (${status.reason}).`;
  }

  if (status.action === "not-due") {
    return "Result sync did not run: no unresolved Football-Data matches have kicked off yet.";
  }

  if (status.action === "failed") {
    return `Result sync failed: ${status.reason} (${status.dateFrom} to ${status.dateTo}).`;
  }

  if (status.action === "never") {
    return "Result sync has not run yet.";
  }

  return `Synced results now: stored ${status.storedResults.length}, skipped ${status.skipped.length} (${status.dateFrom} to ${status.dateTo}).`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
