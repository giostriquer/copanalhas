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
  StoredResult,
  StoredStandingsPost
} from "../storage/database.js";
import type { WorldCupMatch } from "../worldcup/types.js";
import { getLocalDateTimeParts } from "./scheduler.js";
import { canSubmitPredictionAt } from "../worldcup/cutoff.js";
import { formatTeamName } from "../worldcup/team-display.js";
import {
  syncFinishedResults as syncFinishedResultsDefault,
  type SyncFinishedResultsOptions,
  type SyncFinishedResultsResult
} from "../results/sync.js";

const autoPostIntervalMs = 60 * 1000;
const resultSyncIntervalMs = 15 * 60 * 1000;
const resultSyncLookbackDays = 2;

export interface BotRuntimeStore {
  migrate(): void;
  upsertMatches(matches: WorldCupMatch[]): void;
  upsertPrediction(prediction: StoredPrediction): void;
  upsertResult(result: StoredResult): void | Promise<void>;
  listPredictions(): StoredPrediction[];
  listResults(): StoredResult[];
  listPostedMatchCards(): StoredPostedMatchCard[];
  recordPostedMatchCard(card: StoredPostedMatchCard): void;
  clearPostedMatchCardsForDate(channelId: string, postedForDate: string): number;
  clearPredictionsForMatches(matchIds: readonly string[]): number;
  clearResultsForMatches(matchIds: readonly string[]): number;
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
}

export interface StartCopanalhasBotRuntimeOptions {
  config: CopanalhasConfig;
  store: BotRuntimeStore;
  matches: WorldCupMatch[];
  startDiscord(
    config: CopanalhasConfig,
    onMessageResult: (result: DiscordIngestionResult) => void,
    predictionInteractionOptions: PredictionInteractionOptions,
    readyOptions: DiscordClientReadyOptions
  ): Promise<unknown>;
  startInterval(callback: () => void | Promise<void>, intervalMs: number): RuntimeInterval;
  sendMatchCard(message: MatchCardMessage): Promise<string>;
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
  now(): Date;
  writeLine(line: string): void;
}

export async function startCopanalhasBotRuntime(
  options: StartCopanalhasBotRuntimeOptions
): Promise<StartedBotRuntime> {
  options.store.migrate();
  options.store.upsertMatches(options.matches);

  const predictionInteractionOptions = createPredictionInteractionOptions(options);
  const autoPostState: AutoPostRuntimeState = {
    lastRunDate: null,
    lastResult: { action: "never" }
  };
  const resultSyncState: ResultSyncRuntimeState = {
    lastResult: { action: "never" }
  };
  const operatorCommandOptions = createOperatorCommandOptions(
    options,
    autoPostState,
    resultSyncState
  );
  const discordClient = await options.startDiscord(
    options.config,
    createPredictionPersistenceHandler({
      matches: options.matches,
      upsertPrediction: (prediction) => options.store.upsertPrediction(prediction),
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
  await runResultSync(options, operatorCommandOptions, resultSyncState);
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
  options: StartCopanalhasBotRuntimeOptions
): PredictionInteractionOptions {
  return {
    guildId: options.config.guildId,
    channelId: options.config.channelId,
    matches: options.matches,
    timeZone: options.config.timezone,
    now: options.now,
    listPredictions: () => options.store.listPredictions(),
    upsertPrediction: (prediction) => options.store.upsertPrediction(prediction),
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
        now: options.now,
        listPostedMatchCards: () => options.store.listPostedMatchCards(),
        sendMatchCard: options.sendMatchCard,
        recordPostedMatchCard: (card) => options.store.recordPostedMatchCard(card)
      }),
    clearPostedMatchCards: (date) =>
      options.store.clearPostedMatchCardsForDate(options.config.channelId, date),
    clearPredictionsForMatches: (matchIds) => options.store.clearPredictionsForMatches(matchIds),
    clearResultsForMatches: (matchIds) => options.store.clearResultsForMatches(matchIds),
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
        upsertLeaderboardMessage: options.upsertLeaderboardMessage
      });

      options.writeLine(formatLeaderboardDashboardLog(result));

      return result;
    },
    logOperatorCommand: (input, result) =>
      options.writeLine(formatOperatorCommandLog(input, result)),
    logOperatorAutocomplete: (input, result) =>
      options.writeLine(formatOperatorAutocompleteLog(input, result))
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

async function runResultSync(
  options: StartCopanalhasBotRuntimeOptions,
  operatorCommandOptions: OperatorCommandOptions,
  state: ResultSyncRuntimeState
): Promise<void> {
  if (!options.config.resultSyncEnabled || !options.config.footballDataToken) {
    return;
  }

  const syncFinishedResults = options.syncFinishedResults ?? syncFinishedResultsDefault;
  const { dateFrom, dateTo } = getResultSyncDateWindow(options.now(), options.config.timezone);
  const syncResult = await syncFinishedResults({
    enabled: options.config.resultSyncEnabled,
    token: options.config.footballDataToken,
    matches: options.matches,
    dateFrom,
    dateTo,
    now: options.now,
    listResults: () => options.store.listResults(),
    listPredictions: () => options.store.listPredictions(),
    upsertResult: (result) => options.store.upsertResult(result),
    insertScoringRun: (run) => options.store.insertScoringRun(run)
  });
  state.lastResult = resultSyncStatus(syncResult, dateFrom, dateTo);
  options.writeLine(formatResultSyncLog(state.lastResult));

  if (syncResult.action === "synced" && syncResult.storedResults.length > 0) {
    await operatorCommandOptions.updateStandingsDashboard();
    await operatorCommandOptions.updateLeaderboardDashboard();
  }
}

function getResultSyncDateWindow(now: Date, timeZone: string): { dateFrom: string; dateTo: string } {
  const { localDate } = getLocalDateTimeParts(now, timeZone);

  return {
    dateFrom: shiftDate(localDate, -resultSyncLookbackDays),
    dateTo: localDate
  };
}

function shiftDate(localDate: string, days: number): string {
  const date = new Date(`${localDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
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
  const localDateTime = getLocalDateTimeParts(options.now(), options.config.timezone);
  const postedMatchIds = new Set(
    options.store
      .listPostedMatchCards()
      .filter(
        (card) =>
          card.channelId === options.config.channelId &&
          card.postedForDate === localDateTime.localDate
      )
      .map((card) => card.matchId)
  );

  return {
    localDate: localDateTime.localDate,
    localTime: localDateTime.localTime,
    timeZone: options.config.timezone,
    autoPostEnabled: options.config.autoPostEnabled,
    autoPostTime: options.config.autoPostTime,
    todayMatches: options.matches
      .filter((match) => match.localDate === localDateTime.localDate)
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
