import { createPredictionPersistenceHandler } from "./collector.js";
import { runAutoPostTick } from "./auto-posting.js";
import {
  formatAutoPostLog,
  formatLeaderboardDashboardLog,
  formatOperatorAutocompleteLog,
  formatOperatorCommandLog,
  formatPredictionInteractionLog,
  formatResultSyncLog,
  formatStandingsDashboardLog
} from "./dev-log.js";
import { updateLeaderboardDashboard } from "./leaderboard-posting.js";
import { postDueMatchCards } from "./match-card-posting.js";
import {
  postDuePredictionReveals,
  type PredictionRevealSendResult,
  type PredictionRevealThreadMessage
} from "./prediction-reveal-posting.js";
import {
  postDuePredictionResultReveals,
  type PredictionResultThreadMessage
} from "./prediction-result-posting.js";
import { updateStandingsDashboard } from "./standings-posting.js";
import type { MatchCardMessage } from "../discord/components.js";
import type { CopanalhasConfig } from "../discord/config.js";
import type {
  DiscordClientReadyOptions,
  DiscordIngestionResult
} from "../discord/ingestion.js";
import type { PredictionInteractionOptions } from "../discord/interactions.js";
import { registerCopanalhasCommands } from "../discord/commands.js";
import type {
  OperatorCommandOptions,
  RuntimeAutoPostStatus,
  RuntimePredictionState,
  RuntimeResultSyncStatus,
  RuntimeStatusSnapshot
} from "../discord/operator-commands.js";
import type { LeaderboardDashboardMessage } from "../leaderboard/format.js";
import type { StandingsDashboardMessage } from "../standings/format.js";
import type {
  NewScoringRun,
  StoredLeaderboardPost,
  StoredPostedMatchCard,
  StoredPrediction,
  StoredPredictionRevealPost,
  StoredResult,
  StoredStandingsPost
} from "../storage/database.js";
import type { WorldCupMatch } from "../worldcup/types.js";
import { canSubmitPredictionAt } from "../worldcup/cutoff.js";
import { getMatchdayDateTimeParts, isMatchOnMatchday } from "../worldcup/matchday.js";
import { formatTeamName } from "../worldcup/team-display.js";
import {
  syncFinishedResults as syncFinishedResultsDefault,
  type SyncFinishedResultsOptions,
  type SyncFinishedResultsResult
} from "../results/sync.js";
import { planResultSyncAttempt } from "../results/schedule.js";

const autoPostIntervalMs = 60 * 1000;
const predictionRevealIntervalMs = 60 * 1000;
const resultSyncIntervalMs = 15 * 60 * 1000;

export interface BotRuntimeStore {
  migrate(): void;
  upsertMatches(matches: WorldCupMatch[]): void;
  upsertPrediction(prediction: StoredPrediction): void;
  upsertResult(result: StoredResult): void | Promise<void>;
  listPredictions(): StoredPrediction[];
  listResults(): StoredResult[];
  listPostedMatchCards(): StoredPostedMatchCard[];
  recordPostedMatchCard(card: StoredPostedMatchCard): void;
  listPredictionRevealPosts(): StoredPredictionRevealPost[];
  recordPredictionRevealPost(post: StoredPredictionRevealPost): void;
  clearPostedMatchCardsForDate(channelId: string, postedForDate: string): number;
  clearPredictionsForMatches(matchIds: readonly string[]): number;
  clearResultsForMatches(matchIds: readonly string[]): number;
  clearPredictionRevealPostsForMatches(matchIds: readonly string[]): number;
  listStandingsPosts(): StoredStandingsPost[];
  recordStandingsPost(post: StoredStandingsPost): void;
  listLeaderboardPosts(): StoredLeaderboardPost[];
  recordLeaderboardPost(post: StoredLeaderboardPost): void;
  insertScoringRun(run: NewScoringRun): unknown;
}

export interface RuntimeInterval {
  stop(): void;
}

export interface StartedBotRuntime {
  stop(): void | Promise<void>;
}

interface AutoPostRuntimeState {
  lastRunDate: string | null;
  lastResult: RuntimeAutoPostStatus;
}

interface ResultSyncRuntimeState {
  lastResult: RuntimeResultSyncStatus;
  lastAttemptAtUtc: string | null;
}

export interface StartCopanalhasBotRuntimeOptions {
  config: CopanalhasConfig;
  store: BotRuntimeStore;
  matches: WorldCupMatch[];
  startDiscord(
    config: CopanalhasConfig,
    onMessageResult: (result: DiscordIngestionResult) => void | Promise<void>,
    predictionInteractionOptions: PredictionInteractionOptions,
    readyOptions: DiscordClientReadyOptions
  ): Promise<unknown>;
  startInterval(callback: () => void | Promise<void>, intervalMs: number): RuntimeInterval;
  sendMatchCard(message: MatchCardMessage): Promise<string>;
  sendPredictionReveal(message: PredictionRevealThreadMessage): Promise<PredictionRevealSendResult>;
  editPredictionReveal?(message: PredictionResultThreadMessage): Promise<void>;
  upsertStandingsMessage(
    message: StandingsDashboardMessage,
    existingMessageId: string | null
  ): Promise<string>;
  upsertLeaderboardMessage(
    message: LeaderboardDashboardMessage,
    existingMessageId: string | null
  ): Promise<string>;
  syncFinishedResults?(
    options: SyncFinishedResultsOptions
  ): Promise<SyncFinishedResultsResult>;
  resolveUserDisplayNames?(userIds: readonly string[]): Promise<ReadonlyMap<string, string>>;
  now(): Date;
  writeLine(line: string): void;
}

export async function startCopanalhasBotRuntime(
  options: StartCopanalhasBotRuntimeOptions
): Promise<StartedBotRuntime> {
  options.store.migrate();
  options.store.upsertMatches(options.matches);

  const autoPostState: AutoPostRuntimeState = {
    lastRunDate: null,
    lastResult: { action: "never" }
  };
  const resultSyncState: ResultSyncRuntimeState = {
    lastResult: { action: "never" },
    lastAttemptAtUtc: null
  };
  const operatorCommandOptions = createOperatorCommandOptions(
    options,
    autoPostState,
    resultSyncState
  );
  const predictionInteractionOptions = createPredictionInteractionOptions(
    options,
    operatorCommandOptions
  );
  const discordClient = await options.startDiscord(
    options.config,
    createPredictionPersistenceHandler({
      matches: options.matches,
      upsertPrediction: (prediction) => options.store.upsertPrediction(prediction),
      refreshLeaderboardAfterPrediction: async () => {
        await operatorCommandOptions.updateLeaderboardDashboard();
      },
      writeLine: options.writeLine
    }),
    predictionInteractionOptions,
    {
      operatorCommandOptions,
      registerCommands: registerCopanalhasCommands
    }
  );
  await operatorCommandOptions.updateStandingsDashboard();
  await operatorCommandOptions.updateLeaderboardDashboard();
  await runAutoPost(options, operatorCommandOptions, autoPostState);
  await runPredictionReveals(options);
  await runResultSync(options, operatorCommandOptions, resultSyncState);
  await runPredictionResultReveals(options);
  const intervals = startRuntimeIntervals(
    options,
    operatorCommandOptions,
    autoPostState,
    resultSyncState
  );

  return {
    async stop() {
      for (const interval of intervals) {
        interval.stop();
      }

      if (hasDestroy(discordClient)) {
        await discordClient.destroy();
      }
    }
  };
}

function createPredictionInteractionOptions(
  options: StartCopanalhasBotRuntimeOptions,
  operatorCommandOptions: Pick<OperatorCommandOptions, "updateLeaderboardDashboard">
): PredictionInteractionOptions {
  return {
    guildId: options.config.guildId,
    channelId: options.config.channelId,
    matches: options.matches,
    timeZone: options.config.timezone,
    matchdayRolloverTime: options.config.matchdayRolloverTime,
    now: options.now,
    listPredictions: () => options.store.listPredictions(),
    upsertPrediction: (prediction) => options.store.upsertPrediction(prediction),
    refreshLeaderboardAfterPrediction: async () => {
      await operatorCommandOptions.updateLeaderboardDashboard();
    },
    logPredictionInteraction: (result) =>
      options.writeLine(formatPredictionInteractionLog(result))
  };
}

function createOperatorCommandOptions(
  options: StartCopanalhasBotRuntimeOptions,
  autoPostState: AutoPostRuntimeState,
  resultSyncState: ResultSyncRuntimeState
): OperatorCommandOptions {
  return {
    guildId: options.config.guildId,
    channelId: options.config.channelId,
    matches: options.matches,
    timeZone: options.config.timezone,
    matchdayRolloverTime: options.config.matchdayRolloverTime,
    resultSyncEnabled: options.config.resultSyncEnabled,
    now: options.now,
    getRuntimeStatus: () => createRuntimeStatus(options, autoPostState, resultSyncState),
    postDueMatchCards: (date, postSource) =>
      postDueMatchCards({
        matches: options.matches,
        channelId: options.config.channelId,
        date,
        postSource,
        timeZone: options.config.timezone,
        matchdayRolloverTime: options.config.matchdayRolloverTime,
        now: options.now,
        listPostedMatchCards: () => options.store.listPostedMatchCards(),
        sendMatchCard: options.sendMatchCard,
        recordPostedMatchCard: (card) => options.store.recordPostedMatchCard(card)
      }),
    clearPostedMatchCards: (date) =>
      options.store.clearPostedMatchCardsForDate(options.config.channelId, date),
    clearPredictionsForMatches: (matchIds) => options.store.clearPredictionsForMatches(matchIds),
    clearResultsForMatches: (matchIds) => options.store.clearResultsForMatches(matchIds),
    clearPredictionRevealPostsForMatches: (matchIds) =>
      options.store.clearPredictionRevealPostsForMatches(matchIds),
    listPredictions: () => options.store.listPredictions(),
    listResults: () => options.store.listResults(),
    upsertResult: (result) => options.store.upsertResult(result),
    listStandingsPosts: () => options.store.listStandingsPosts(),
    updateStandingsDashboard: async () => {
      const result = await updateStandingsDashboard({
        guildId: options.config.guildId,
        channelId: options.config.channelId,
        matches: options.matches,
        results: options.store.listResults(),
        timeZone: options.config.timezone,
        now: options.now,
        listStandingsPosts: () => options.store.listStandingsPosts(),
        recordStandingsPost: (post) => options.store.recordStandingsPost(post),
        upsertStandingsMessage: options.upsertStandingsMessage
      });

      options.writeLine(formatStandingsDashboardLog(result));

      return result;
    },
    listLeaderboardPosts: () => options.store.listLeaderboardPosts(),
    updateLeaderboardDashboard: async () => {
      const result = await updateLeaderboardDashboard({
        guildId: options.config.guildId,
        channelId: options.config.channelId,
        predictions: options.store.listPredictions(),
        results: options.store.listResults(),
        timeZone: options.config.timezone,
        now: options.now,
        listLeaderboardPosts: () => options.store.listLeaderboardPosts(),
        recordLeaderboardPost: (post) => options.store.recordLeaderboardPost(post),
        ...(options.resolveUserDisplayNames
          ? { resolveUserDisplayNames: options.resolveUserDisplayNames }
          : {}),
        upsertLeaderboardMessage: options.upsertLeaderboardMessage
      });

      options.writeLine(formatLeaderboardDashboardLog(result));

      return result;
    },
    updatePredictionResultReveals: async () => runPredictionResultReveals(options),
    logOperatorCommand: (input, result) =>
      options.writeLine(formatOperatorCommandLog(input, result)),
    logOperatorAutocomplete: (input, result) =>
      options.writeLine(formatOperatorAutocompleteLog(input, result)),
    ...(options.resolveUserDisplayNames
      ? { resolveUserDisplayNames: options.resolveUserDisplayNames }
      : {})
  };
}

function startRuntimeIntervals(
  options: StartCopanalhasBotRuntimeOptions,
  operatorCommandOptions: OperatorCommandOptions,
  autoPostState: AutoPostRuntimeState,
  resultSyncState: ResultSyncRuntimeState
): RuntimeInterval[] {
  const intervals: RuntimeInterval[] = [];

  intervals.push(
    options.startInterval(async () => {
      await runAutoPost(options, operatorCommandOptions, autoPostState);
    }, autoPostIntervalMs)
  );

  intervals.push(
    options.startInterval(async () => {
      await runPredictionReveals(options);
      await runPredictionResultReveals(options);
    }, predictionRevealIntervalMs)
  );

  if (options.config.resultSyncEnabled && options.config.footballDataToken) {
    intervals.push(
      options.startInterval(async () => {
        await runResultSync(options, operatorCommandOptions, resultSyncState);
      }, resultSyncIntervalMs)
    );
  }

  return intervals;
}

async function runAutoPost(
  options: StartCopanalhasBotRuntimeOptions,
  operatorCommandOptions: OperatorCommandOptions,
  state: AutoPostRuntimeState
): Promise<void> {
  const result = await runAutoPostTick({
    enabled: options.config.autoPostEnabled,
    targetTime: options.config.autoPostTime,
    timeZone: options.config.timezone,
    matchdayRolloverTime: options.config.matchdayRolloverTime,
    lastRunDate: state.lastRunDate,
    now: options.now,
    postDueMatchCards: (date) => operatorCommandOptions.postDueMatchCards(date, "auto")
  });
  state.lastResult = result;

  if (result.action === "posted") {
    state.lastRunDate = result.localDate;
    options.writeLine(formatAutoPostLog(result));
  }
}

async function runPredictionReveals(options: StartCopanalhasBotRuntimeOptions): Promise<void> {
  const result = await postDuePredictionReveals({
    channelId: options.config.channelId,
    matches: options.matches,
    predictions: options.store.listPredictions(),
    now: options.now,
    listPostedMatchCards: () => options.store.listPostedMatchCards(),
    listPredictionRevealPosts: () => options.store.listPredictionRevealPosts(),
    sendPredictionReveal: options.sendPredictionReveal,
    recordPredictionRevealPost: (post) => options.store.recordPredictionRevealPost(post)
  });

  if (result.posted.length > 0) {
    options.writeLine(
      `[prediction-reveal] batches=${result.posted.length} matches=${result.posted
        .flatMap((post) => post.matchIds)
        .join(",")}`
    );
  }
}

async function runPredictionResultReveals(
  options: StartCopanalhasBotRuntimeOptions
): Promise<void> {
  if (!options.editPredictionReveal) {
    return;
  }

  const result = await postDuePredictionResultReveals({
    channelId: options.config.channelId,
    matches: options.matches,
    predictions: options.store.listPredictions(),
    results: options.store.listResults(),
    now: options.now,
    listPredictionRevealPosts: () => options.store.listPredictionRevealPosts(),
    editPredictionReveal: options.editPredictionReveal,
    recordPredictionRevealPost: (post) => options.store.recordPredictionRevealPost(post)
  });

  if (result.edited.length > 0) {
    options.writeLine(
      `[prediction-result] batches=${result.edited.length} matches=${result.edited
        .flatMap((post) => post.matchIds)
        .join(",")}`
    );
  }
}

async function runResultSync(
  options: StartCopanalhasBotRuntimeOptions,
  operatorCommandOptions: OperatorCommandOptions,
  state: ResultSyncRuntimeState
): Promise<void> {
  if (!options.config.resultSyncEnabled) {
    state.lastResult = { action: "disabled", reason: "disabled" };
    options.writeLine(formatResultSyncLog(state.lastResult));
    return;
  }

  if (!options.config.footballDataToken) {
    state.lastResult = { action: "disabled", reason: "missing-token" };
    options.writeLine(formatResultSyncLog(state.lastResult));
    return;
  }

  const syncFinishedResults = options.syncFinishedResults ?? syncFinishedResultsDefault;
  const syncPlan = planResultSyncAttempt({
    matches: options.matches,
    results: options.store.listResults(),
    now: options.now(),
    firstCheckDelayMinutes: options.config.resultSyncFirstCheckMinutes,
    retryIntervalMinutes: options.config.resultSyncRetryMinutes,
    lastAttemptAtUtc: state.lastAttemptAtUtc
  });

  if (syncPlan.action === "not-due") {
    state.lastResult = syncPlan;
    options.writeLine(formatResultSyncLog(state.lastResult));
    return;
  }

  state.lastAttemptAtUtc = options.now().toISOString();
  const syncResult = await syncFinishedResults({
    enabled: options.config.resultSyncEnabled,
    token: options.config.footballDataToken,
    matches: options.matches,
    dateFrom: syncPlan.dateFrom,
    dateTo: syncPlan.dateTo,
    now: options.now,
    listResults: () => options.store.listResults(),
    listPredictions: () => options.store.listPredictions(),
    upsertResult: (result) => options.store.upsertResult(result),
    insertScoringRun: (run) => options.store.insertScoringRun(run)
  });
  state.lastResult = resultSyncStatus(syncResult, syncPlan.dateFrom, syncPlan.dateTo);
  options.writeLine(formatResultSyncLog(state.lastResult));

  if (syncResult.action === "synced" && syncResult.storedResults.length > 0) {
    await operatorCommandOptions.updateStandingsDashboard();
    await operatorCommandOptions.updateLeaderboardDashboard();
    await runPredictionResultReveals(options);
  }
}

function resultSyncStatus(
  result: SyncFinishedResultsResult,
  dateFrom: string,
  dateTo: string
): RuntimeResultSyncStatus {
  if (result.action === "disabled") {
    return result;
  }

  if (result.action === "failed") {
    return { ...result, dateFrom, dateTo };
  }

  return { ...result, dateFrom, dateTo };
}

function createRuntimeStatus(
  options: StartCopanalhasBotRuntimeOptions,
  autoPostState: AutoPostRuntimeState,
  resultSyncState: ResultSyncRuntimeState
): RuntimeStatusSnapshot {
  const localDateTime = getMatchdayDateTimeParts(
    options.now(),
    options.config.timezone,
    options.config.matchdayRolloverTime
  );
  const postedMatchIds = new Set(
    options.store
      .listPostedMatchCards()
      .filter(
        (card) =>
          card.channelId === options.config.channelId &&
          card.postedForDate === localDateTime.matchdayDate
      )
      .map((card) => card.matchId)
  );

  return {
    localDate: localDateTime.matchdayDate,
    localTime: localDateTime.localTime,
    timeZone: options.config.timezone,
    autoPostEnabled: options.config.autoPostEnabled,
    autoPostTime: options.config.autoPostTime,
    todayMatches: options.matches
      .filter((match) =>
        isMatchOnMatchday(
          match,
          localDateTime.matchdayDate,
          options.config.timezone,
          options.config.matchdayRolloverTime
        )
      )
      .toSorted((left, right) => left.matchNumber - right.matchNumber)
      .map((match) => ({
        matchId: match.id,
        matchNumber: match.matchNumber,
        label: `${formatTeamName(match.homeTeam)} x ${formatTeamName(match.awayTeam)}`,
        posted: postedMatchIds.has(match.id),
        predictionState: predictionStateForMatch(match, options.now())
      })),
    lastAutoPost: autoPostState.lastResult,
    resultSyncEnabled: options.config.resultSyncEnabled,
    lastResultSync: resultSyncState.lastResult
  };
}

function predictionStateForMatch(match: WorldCupMatch, now: Date): RuntimePredictionState {
  const submissionWindow = canSubmitPredictionAt(match, now);

  if (submissionWindow.ok) {
    return "open";
  }

  return submissionWindow.reason === "closed" ? "closed" : "missing-kickoff";
}

function hasDestroy(value: unknown): value is { destroy(): void | Promise<void> } {
  return typeof value === "object" && value !== null && "destroy" in value;
}
