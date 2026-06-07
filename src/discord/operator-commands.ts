import { MessageFlags, type ChatInputCommandInteraction, type Interaction } from "discord.js";

import type { PostDueMatchCardsResult } from "../app/match-card-posting.js";
import { formatLeaderboard } from "../leaderboard/format.js";
import { formatUserPredictionSummary } from "../predictions/personal-summary.js";
import { parseScoreInput } from "../predictions/score-parser.js";
import { formatPredictionAudit, formatPredictionReveal } from "../predictions/visibility.js";
import { buildLeaderboard, scoreMatch, type MatchResult } from "../scoring/scoring.js";
import type {
  PostedMatchCardSource,
  StoredLeaderboardPost,
  StoredPrediction,
  StoredResult,
  StoredStandingsPost
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
import { copanalhasCommandName } from "./commands.js";

export type OperatorSubcommand =
  | "post-today"
  | "post-date"
  | "clear-posted-date"
  | "reset-test-date"
  | "status"
  | "standings"
  | "leaderboard"
  | "meus-palpites"
  | "predictions"
  | "reveal"
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
  getRuntimeStatus?(): RuntimeStatusSnapshot;
  postDueMatchCards(date: string, postSource: PostedMatchCardSource): Promise<PostDueMatchCardsResult>;
  clearPostedMatchCards(date: string): number;
  clearPredictionsForMatches(matchIds: readonly string[]): number;
  clearResultsForMatches(matchIds: readonly string[]): number;
  clearPredictionRevealPostsForMatches(matchIds: readonly string[]): number;
  listPredictions(): StoredPrediction[];
  listResults(): MatchResult[];
  upsertResult(result: StoredResult): void | Promise<void>;
  listStandingsPosts(): StoredStandingsPost[];
  updateStandingsDashboard(): Promise<UpdateStandingsDashboardResult>;
  listLeaderboardPosts(): StoredLeaderboardPost[];
  updateLeaderboardDashboard(): Promise<UpdateLeaderboardDashboardResult>;
  resolveUserDisplayNames?(userIds: readonly string[]): Promise<ReadonlyMap<string, string>>;
  logOperatorCommand?(input: OperatorCommandInput, result: OperatorCommandResult): void;
  logOperatorAutocomplete?(
    input: OperatorAutocompleteInput,
    result: OperatorAutocompleteResult
  ): void;
}

export type OperatorCommandResult =
  | { action: "ignored"; reason: "wrong-guild" | "wrong-channel" | "unknown-command" }
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
  | { action: "posted"; localDate: string; posted: string[]; skipped: string[] };

export type RuntimeResultSyncStatus =
  | { action: "never" }
  | { action: "disabled"; reason: "disabled" | "missing-token" }
  | { action: "failed"; dateFrom: string; dateTo: string; reason: "rate-limited" | "unavailable" }
  | { action: "synced"; dateFrom: string; dateTo: string; storedResults: string[]; skipped: string[] };

export interface RuntimeStatusSnapshot {
  localDate: string;
  localTime: string;
  timeZone: string;
  autoPostEnabled: boolean;
  autoPostTime: string;
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

    const matchIds = options.matches
      .filter((match) =>
        isMatchOnMatchday(match, date, options.timeZone, options.matchdayRolloverTime)
      )
      .toSorted((left, right) => left.matchNumber - right.matchNumber)
      .map((match) => match.id);

    const postedCards = options.clearPostedMatchCards(date);
    const predictions = options.clearPredictionsForMatches(matchIds);
    const results = options.clearResultsForMatches(matchIds);
    const predictionReveals = options.clearPredictionRevealPostsForMatches(matchIds);
    await options.updateStandingsDashboard();
    await options.updateLeaderboardDashboard();

    return reply(
      [
        `Reset test data for ${date}.`,
        `Posted card records: ${postedCards}`,
        `Predictions: ${predictions}`,
        `Results: ${results}`,
        `Prediction reveals: ${predictionReveals}`,
        "Standings refreshed.",
        "Leaderboard refreshed."
      ].join("\n")
    );
  }

  if (command.subcommand === "status") {
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

    await options.upsertResult({
      matchId: match.id,
      homeScore: parsedScore.score.homeScore,
      awayScore: parsedScore.score.awayScore,
      recordedAt: options.now().toISOString(),
      resultSource: "manual",
      externalMatchId: null,
      fetchedAt: null
    });
    await options.updateStandingsDashboard();
    await options.updateLeaderboardDashboard();

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
    !["predictions", "reveal", "result"].includes(interaction.subcommand)
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

  const shouldDeferPrivately = subcommand !== "reveal";

  if (shouldDeferPrivately) {
    await interaction.deferReply({
      flags: MessageFlags.Ephemeral
    });
  }

  const commandInput: OperatorCommandInput = {
    guildId: interaction.guildId,
    channelId: interaction.channelId,
    userId: interaction.user.id,
    subcommand,
    options: readCommandOptions(subcommand, interaction)
  };
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

  if (subcommand === "predictions" || subcommand === "reveal") {
    return {
      match: interaction.options.getString("match", true)
    };
  }

  if (subcommand === "result") {
    return {
      match: interaction.options.getString("match", true),
      score: interaction.options.getString("score", true)
    };
  }

  return {};
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
    value === "meus-palpites" ||
    value === "predictions" ||
    value === "reveal" ||
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
    }`,
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

  return `posted ${status.posted.length}, skipped ${status.skipped.length} on ${status.localDate}`;
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

  if (status.action === "failed") {
    return [`Last result sync: failed ${status.reason} (${status.dateFrom} to ${status.dateTo})`];
  }

  return [
    `Last result sync: synced ${status.storedResults.length}, skipped ${status.skipped.length} (${status.dateFrom} to ${status.dateTo})`
  ];
}
