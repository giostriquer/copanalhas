import { createPredictionPersistenceHandler } from "./collector.js";
import { runAutoPostTick } from "./auto-posting.js";
import {
  runMatchStartAlertTick,
  type MatchStartAlertMessage
} from "./match-start-alerts.js";
import {
  formatAutoPostLog,
  formatLeaderboardDashboardLog,
  formatOperatorAutocompleteLog,
  formatOperatorCommandLog,
  formatPredictionInteractionLog,
  formatRuntimeLogLine,
  formatResultSyncErrorLog,
  formatResultSyncLog,
  formatResultSyncStartLog,
  formatStandingsDashboardLog
} from "./dev-log.js";
import {
  formatOperatorHealthLogLines,
  type OperatorHealthResultSyncStatus,
  type OperatorHealthSnapshot
} from "./operator-health.js";
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
  StoredMatchStartAlert,
  StoredLeaderboardPost,
  StoredPostedMatchCard,
  StoredPrediction,
  StoredPredictionRevealPost,
  StoredResult,
  StoredStandingsPost
} from "../storage/database.js";
import type { WorldCupMatch } from "../worldcup/types.js";
import { canSubmitPredictionAt } from "../worldcup/cutoff.js";
import {
  getMatchdayDateForMatch,
  getMatchdayDateTimeParts,
  isMatchOnMatchday
} from "../worldcup/matchday.js";
import { formatTeamName } from "../worldcup/team-display.js";
import {
  syncFinishedResults as syncFinishedResultsDefault,
  type SyncFinishedResultsOptions,
  type SyncFinishedResultsResult
} from "../results/sync.js";
import { planForcedResultSyncAttempt, planResultSyncAttempt } from "../results/schedule.js";

const autoPostIntervalMs = 60 * 1000;
const matchStartAlertIntervalMs = 60 * 1000;
const predictionRevealIntervalMs = 60 * 1000;
const resultSyncIntervalMs = 60 * 1000;

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
  listMatchStartAlerts(): StoredMatchStartAlert[];
  recordMatchStartAlert(alert: StoredMatchStartAlert): void;
  markMatchStartAlertsDeleted(matchIds: readonly string[], deletedAt: string): number;
  clearPostedMatchCardsForDate(channelId: string, postedForDate: string): number;
  clearPredictionsForMatches(matchIds: readonly string[]): number;
  clearResultsForMatches(matchIds: readonly string[]): number;
  clearPredictionRevealPostsForMatches(matchIds: readonly string[]): number;
  clearMatchStartAlertsForMatches(matchIds: readonly string[]): number;
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
  sendMatchStartAlert?(message: MatchStartAlertMessage): Promise<string>;
  deleteMatchStartAlert?(messageId: string): Promise<void>;
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
      writeLine: (line) => writeRuntimeLine(options, line)
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
  await runMatchStartAlerts(options);
  const startupHealth = createOperatorHealthSnapshot(options, autoPostState, resultSyncState);

  for (const line of formatOperatorHealthLogLines(startupHealth)) {
    writeRuntimeLine(options, line);
  }
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

function writeRuntimeLine(options: StartCopanalhasBotRuntimeOptions, line: string): void {
  options.writeLine(formatRuntimeLogLine(options.now(), line));
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
      writeRuntimeLine(options, formatPredictionInteractionLog(result))
  };
}

function createOperatorCommandOptions(
  options: StartCopanalhasBotRuntimeOptions,
  autoPostState: AutoPostRuntimeState,
  resultSyncState: ResultSyncRuntimeState
): OperatorCommandOptions {
  const updateStandingsDashboardForRuntime = async () => {
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

    writeRuntimeLine(options, formatStandingsDashboardLog(result));

    return result;
  };
  const updateLeaderboardDashboardForRuntime = async () => {
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

    writeRuntimeLine(options, formatLeaderboardDashboardLog(result));

    return result;
  };
  const resultSyncRefreshers = {
    updateStandingsDashboard: updateStandingsDashboardForRuntime,
    updateLeaderboardDashboard: updateLeaderboardDashboardForRuntime
  };

  return {
    guildId: options.config.guildId,
    channelId: options.config.channelId,
    matches: options.matches,
    timeZone: options.config.timezone,
    matchdayRolloverTime: options.config.matchdayRolloverTime,
    resultSyncEnabled: options.config.resultSyncEnabled,
    now: options.now,
    getOperatorHealth: () => createOperatorHealthSnapshot(options, autoPostState, resultSyncState),
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
    clearMatchStartAlertsForMatches: (matchIds) =>
      options.store.clearMatchStartAlertsForMatches(matchIds),
    listPredictions: () => options.store.listPredictions(),
    listResults: () => options.store.listResults(),
    upsertResult: (result) => options.store.upsertResult(result),
    listStandingsPosts: () => options.store.listStandingsPosts(),
    updateStandingsDashboard: updateStandingsDashboardForRuntime,
    listLeaderboardPosts: () => options.store.listLeaderboardPosts(),
    updateLeaderboardDashboard: updateLeaderboardDashboardForRuntime,
    updatePredictionResultReveals: async () => runPredictionResultReveals(options),
    syncResultsNow: async () =>
      runResultSync(options, resultSyncRefreshers, resultSyncState, { force: true }),
    logOperatorCommand: (input, result) =>
      writeRuntimeLine(options, formatOperatorCommandLog(input, result)),
    logOperatorAutocomplete: (input, result) =>
      writeRuntimeLine(options, formatOperatorAutocompleteLog(input, result)),
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

  if (shouldRunMatchStartAlertLoop(options)) {
    intervals.push(
      options.startInterval(async () => {
        await runMatchStartAlerts(options);
      }, matchStartAlertIntervalMs)
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
    windowDays: options.config.autoPostWindowDays,
    lastRunDate: state.lastRunDate,
    now: options.now,
    postDueMatchCards: (date) => operatorCommandOptions.postDueMatchCards(date, "auto")
  });
  state.lastResult = result;

  if (result.action === "posted") {
    state.lastRunDate = result.localDate;
    writeRuntimeLine(options, formatAutoPostLog(result));
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
    writeRuntimeLine(
      options,
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
    writeRuntimeLine(
      options,
      `[prediction-result] batches=${result.edited.length} matches=${result.edited
        .flatMap((post) => post.matchIds)
        .join(",")}`
    );
  }
}

async function runMatchStartAlerts(options: StartCopanalhasBotRuntimeOptions): Promise<void> {
  if (!options.sendMatchStartAlert || !options.deleteMatchStartAlert) {
    return;
  }

  if (!shouldRunMatchStartAlertLoop(options)) {
    return;
  }

  const result = await runMatchStartAlertTick({
    channelId: options.config.channelId,
    roleId: options.config.matchStartRoleId ?? null,
    matches: options.matches,
    results: options.store.listResults(),
    alerts: options.store.listMatchStartAlerts(),
    now: options.now,
    sendAlert: options.sendMatchStartAlert,
    deleteAlert: options.deleteMatchStartAlert,
    recordAlert: (alert) => options.store.recordMatchStartAlert(alert),
    markAlertDeleted: (matchIds, deletedAt) =>
      options.store.markMatchStartAlertsDeleted(matchIds, deletedAt),
    ...(options.config.matchStartAlertDeleteAfterMinutes !== undefined
      ? { deleteAfterMinutes: options.config.matchStartAlertDeleteAfterMinutes }
      : {}),
    ...(options.config.matchStartAlertLeadMinutes !== undefined
      ? { startLeadMinutes: options.config.matchStartAlertLeadMinutes }
      : {}),
    ...(options.config.matchStartAlertGraceMinutes !== undefined
      ? { startGraceMinutes: options.config.matchStartAlertGraceMinutes }
      : {})
  });

  if (result.posted.length === 0 && result.deleted.length === 0) {
    return;
  }

  writeRuntimeLine(
    options,
    `[match-start] posted=${result.posted.length} deleted=${result.deleted.length} matches=${formatIdList(
      result.posted
    )} messages=${formatIdList(result.deleted)}`
  );
}

async function runResultSync(
  options: StartCopanalhasBotRuntimeOptions,
  operatorCommandOptions: Pick<
    OperatorCommandOptions,
    "updateStandingsDashboard" | "updateLeaderboardDashboard"
  >,
  state: ResultSyncRuntimeState,
  runOptions: { force?: boolean } = {}
): Promise<RuntimeResultSyncStatus> {
  if (!options.config.resultSyncEnabled) {
    state.lastResult = { action: "disabled", reason: "disabled" };
    writeRuntimeLine(options, formatResultSyncLog(state.lastResult));
    return state.lastResult;
  }

  if (!options.config.footballDataToken) {
    state.lastResult = { action: "disabled", reason: "missing-token" };
    writeRuntimeLine(options, formatResultSyncLog(state.lastResult));
    return state.lastResult;
  }

  const syncFinishedResults = options.syncFinishedResults ?? syncFinishedResultsDefault;
  const syncMode = runOptions.force ? "forced" : "scheduled";
  const syncPlan = runOptions.force
    ? planForcedResultSyncAttempt({
        matches: options.matches,
        results: options.store.listResults(),
        now: options.now()
      })
    : planResultSyncAttempt({
        matches: options.matches,
        results: options.store.listResults(),
        now: options.now(),
        firstCheckDelayMinutes: options.config.resultSyncFirstCheckMinutes,
        retryIntervalMinutes: options.config.resultSyncRetryMinutes,
        lastAttemptAtUtc: state.lastAttemptAtUtc
      });

  if (syncPlan.action === "not-due") {
    const previousResult = state.lastResult;
    state.lastResult = syncPlan;

    if (shouldLogResultSyncStatus(previousResult, state.lastResult)) {
      writeRuntimeLine(options, formatResultSyncLog(state.lastResult));
    }

    return state.lastResult;
  }

  state.lastAttemptAtUtc = options.now().toISOString();
  writeRuntimeLine(options, formatResultSyncStartLog({ mode: syncMode, ...syncPlan }));

  let syncResult: SyncFinishedResultsResult;

  try {
    syncResult = await syncFinishedResults({
      enabled: options.config.resultSyncEnabled,
      token: options.config.footballDataToken,
      matches: options.matches,
      pendingMatchIds: syncPlan.pendingMatchIds,
      dateFrom: syncPlan.dateFrom,
      dateTo: syncPlan.dateTo,
      now: options.now,
      listResults: () => options.store.listResults(),
      listPredictions: () => options.store.listPredictions(),
      upsertResult: (result) => options.store.upsertResult(result),
      insertScoringRun: (run) => options.store.insertScoringRun(run)
    });
  } catch (error) {
    writeRuntimeLine(
      options,
      formatResultSyncErrorLog({
        mode: syncMode,
        dateFrom: syncPlan.dateFrom,
        dateTo: syncPlan.dateTo,
        error
      })
    );
    state.lastResult = {
      action: "failed",
      dateFrom: syncPlan.dateFrom,
      dateTo: syncPlan.dateTo,
      reason: "unavailable"
    };
    writeRuntimeLine(options, formatResultSyncLog(state.lastResult));

    return state.lastResult;
  }

  state.lastResult = resultSyncStatus(syncResult, syncPlan.dateFrom, syncPlan.dateTo);
  writeRuntimeLine(options, formatResultSyncLog(state.lastResult));

  if (syncResult.action === "synced" && syncResult.storedResults.length > 0) {
    await operatorCommandOptions.updateStandingsDashboard();
    await operatorCommandOptions.updateLeaderboardDashboard();
    await runPredictionResultReveals(options);
    await runMatchStartAlerts(options);
  }

  return state.lastResult;
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
    autoPostWindowDays: options.config.autoPostWindowDays,
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

function createOperatorHealthSnapshot(
  options: StartCopanalhasBotRuntimeOptions,
  autoPostState: AutoPostRuntimeState,
  resultSyncState: ResultSyncRuntimeState
): OperatorHealthSnapshot {
  const runtimeStatus = createRuntimeStatus(options, autoPostState, resultSyncState);
  const postedCards = options.store
    .listPostedMatchCards()
    .filter((card) => card.channelId === options.config.channelId);
  const revealedMatchIds = new Set(
    options.store
      .listPredictionRevealPosts()
      .filter((post) => post.channelId === options.config.channelId)
      .map((post) => post.matchId)
  );
  const postedMatchIds = new Set(postedCards.map((card) => card.matchId));
  const standingsPosts = options.store
    .listStandingsPosts()
    .filter(
      (post) =>
        post.guildId === options.config.guildId && post.channelId === options.config.channelId
    );
  const leaderboardPost = options.store
    .listLeaderboardPosts()
    .find(
      (post) =>
        post.guildId === options.config.guildId && post.channelId === options.config.channelId
    );

  return {
    discord: {
      online: true,
      guildId: options.config.guildId,
      channelId: options.config.channelId
    },
    localDate: runtimeStatus.localDate,
    localTime: runtimeStatus.localTime,
    timeZone: runtimeStatus.timeZone,
    autoPostEnabled: runtimeStatus.autoPostEnabled,
    autoPostTime: runtimeStatus.autoPostTime,
    autoPostWindowDays: runtimeStatus.autoPostWindowDays,
    nextMatchday: nextMatchdayStatus(options, runtimeStatus.localDate, postedCards),
    predictionWindows: predictionWindowCounts(runtimeStatus.todayMatches),
    pendingPredictionReveals: options.matches
      .filter((match) => {
        if (!postedMatchIds.has(match.id) || revealedMatchIds.has(match.id)) {
          return false;
        }

        const submissionWindow = canSubmitPredictionAt(match, options.now());

        return !submissionWindow.ok && submissionWindow.reason === "closed";
      })
      .toSorted((left, right) => left.matchNumber - right.matchNumber)
      .map((match) => ({
        matchId: match.id,
        matchNumber: match.matchNumber,
        label: `${formatTeamName(match.homeTeam)} x ${formatTeamName(match.awayTeam)}`
      })),
    footballDataConfigured: options.config.footballDataToken !== null,
    resultSyncEnabled: options.config.resultSyncEnabled,
    resultSyncPlan: resultSyncPlanStatus(options, resultSyncState),
    lastAutoPost: runtimeStatus.lastAutoPost,
    lastResultSync: runtimeStatus.lastResultSync,
    standingsPosts: {
      present: standingsPosts.length,
      expected: 2,
      lastUpdatedAt: latestTimestamp(standingsPosts.map((post) => post.updatedAt))
    },
    leaderboardPost: {
      present: leaderboardPost !== undefined,
      lastUpdatedAt: leaderboardPost?.updatedAt ?? null
    },
    data: {
      matchesLoaded: options.matches.length,
      missingKickoffTimes: options.matches.filter((match) => !match.kickoffAtUtc).length
    }
  };
}

function nextMatchdayStatus(
  options: StartCopanalhasBotRuntimeOptions,
  currentMatchdayDate: string,
  postedCards: readonly StoredPostedMatchCard[]
): OperatorHealthSnapshot["nextMatchday"] {
  const matchesByDate = new Map<string, WorldCupMatch[]>();

  for (const match of options.matches) {
    const matchdayDate = getMatchdayDateForMatch(
      match,
      options.config.timezone,
      options.config.matchdayRolloverTime
    );

    if (matchdayDate < currentMatchdayDate) {
      continue;
    }

    const matches = matchesByDate.get(matchdayDate) ?? [];
    matches.push(match);
    matchesByDate.set(matchdayDate, matches);
  }

  const nextDate = [...matchesByDate.keys()].sort().at(0);

  if (!nextDate) {
    return null;
  }

  const matches = matchesByDate.get(nextDate) ?? [];
  const postedMatchIds = new Set(
    postedCards.filter((card) => card.postedForDate === nextDate).map((card) => card.matchId)
  );

  return {
    date: nextDate,
    matchCount: matches.length,
    postedCount: matches.filter((match) => postedMatchIds.has(match.id)).length
  };
}

function predictionWindowCounts(matches: readonly { predictionState: RuntimePredictionState }[]): {
  open: number;
  closed: number;
  missingKickoff: number;
} {
  return {
    open: matches.filter((match) => match.predictionState === "open").length,
    closed: matches.filter((match) => match.predictionState === "closed").length,
    missingKickoff: matches.filter((match) => match.predictionState === "missing-kickoff").length
  };
}

function resultSyncPlanStatus(
  options: StartCopanalhasBotRuntimeOptions,
  state: ResultSyncRuntimeState
): OperatorHealthResultSyncStatus {
  if (!options.config.resultSyncEnabled) {
    return { action: "disabled", reason: "disabled" };
  }

  if (!options.config.footballDataToken) {
    return { action: "disabled", reason: "missing-token" };
  }

  return planResultSyncAttempt({
    matches: options.matches,
    results: options.store.listResults(),
    now: options.now(),
    firstCheckDelayMinutes: options.config.resultSyncFirstCheckMinutes,
    retryIntervalMinutes: options.config.resultSyncRetryMinutes,
    lastAttemptAtUtc: state.lastAttemptAtUtc
  });
}

function latestTimestamp(timestamps: readonly string[]): string | null {
  return timestamps.toSorted().at(-1) ?? null;
}

function shouldLogResultSyncStatus(
  previous: RuntimeResultSyncStatus,
  next: RuntimeResultSyncStatus
): boolean {
  if (next.action !== "not-due") {
    return true;
  }

  if (previous.action !== "not-due") {
    return true;
  }

  return (
    previous.nextCheckAtUtc !== next.nextCheckAtUtc ||
    !sameIds(previous.pendingMatchIds, next.pendingMatchIds)
  );
}

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function shouldRunMatchStartAlertLoop(options: StartCopanalhasBotRuntimeOptions): boolean {
  return (
    (options.config.matchStartRoleId ?? null) !== null ||
    options.store
      .listMatchStartAlerts()
      .some((alert) => alert.channelId === options.config.channelId && alert.deletedAt === null)
  );
}

function formatIdList(ids: readonly string[]): string {
  return ids.length > 0 ? ids.join(",") : "none";
}

function hasDestroy(value: unknown): value is { destroy(): void | Promise<void> } {
  return typeof value === "object" && value !== null && "destroy" in value;
}
