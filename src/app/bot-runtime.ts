import { createPredictionPersistenceHandler } from "./collector.js";
import { runAutoPostTick } from "./auto-posting.js";
import { postDueMatchCards } from "./match-card-posting.js";
import type { MatchCardMessage } from "../discord/components.js";
import type { CopanalhasConfig } from "../discord/config.js";
import type {
  DiscordClientReadyOptions,
  DiscordIngestionResult
} from "../discord/ingestion.js";
import type { PredictionInteractionOptions } from "../discord/interactions.js";
import type { OperatorCommandOptions } from "../discord/operator-commands.js";
import { registerCopanalhasCommands } from "../discord/commands.js";
import type { ScorePrediction } from "../scoring/scoring.js";
import type {
  NewScoringRun,
  StoredPostedMatchCard,
  StoredPrediction,
  StoredResult
} from "../storage/database.js";
import type { WorldCupMatch } from "../worldcup/types.js";
import { getLocalDateTimeParts } from "./scheduler.js";
import { syncFinishedResults } from "../results/sync.js";

const autoPostIntervalMs = 60 * 1000;
const resultSyncIntervalMs = 15 * 60 * 1000;

export interface BotRuntimeStore {
  migrate(): void;
  upsertMatches(matches: WorldCupMatch[]): void;
  upsertPrediction(prediction: StoredPrediction): void;
  upsertResult(result: StoredResult): void | Promise<void>;
  listPredictions(): ScorePrediction[];
  listResults(): StoredResult[];
  listPostedMatchCards(): StoredPostedMatchCard[];
  recordPostedMatchCard(card: StoredPostedMatchCard): void;
  insertScoringRun(run: NewScoringRun): unknown;
}

export interface RuntimeInterval {
  stop(): void;
}

export interface StartedBotRuntime {
  stop(): void | Promise<void>;
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
  sendMatchCard(matchId: string, message: MatchCardMessage): Promise<string>;
  now(): Date;
  writeLine(line: string): void;
}

export async function startCopanalhasBotRuntime(
  options: StartCopanalhasBotRuntimeOptions
): Promise<StartedBotRuntime> {
  options.store.migrate();
  options.store.upsertMatches(options.matches);

  const predictionInteractionOptions = createPredictionInteractionOptions(options);
  const operatorCommandOptions = createOperatorCommandOptions(options);
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
  const intervals = startRuntimeIntervals(options, operatorCommandOptions);

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
    upsertPrediction: (prediction) => options.store.upsertPrediction(prediction)
  };
}

function createOperatorCommandOptions(
  options: StartCopanalhasBotRuntimeOptions
): OperatorCommandOptions {
  return {
    guildId: options.config.guildId,
    channelId: options.config.channelId,
    matches: options.matches,
    timeZone: options.config.timezone,
    resultSyncEnabled: options.config.resultSyncEnabled,
    now: options.now,
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
    listPredictions: () => options.store.listPredictions(),
    listResults: () => options.store.listResults(),
    upsertResult: (result) => options.store.upsertResult(result)
  };
}

function startRuntimeIntervals(
  options: StartCopanalhasBotRuntimeOptions,
  operatorCommandOptions: OperatorCommandOptions
): RuntimeInterval[] {
  const intervals: RuntimeInterval[] = [];
  let lastAutoPostDate: string | null = null;

  intervals.push(
    options.startInterval(async () => {
      const result = await runAutoPostTick({
        enabled: options.config.autoPostEnabled,
        targetTime: options.config.autoPostTime,
        timeZone: options.config.timezone,
        lastRunDate: lastAutoPostDate,
        now: options.now,
        postDueMatchCards: (date) => operatorCommandOptions.postDueMatchCards(date, "auto")
      });

      if (result.action === "posted") {
        lastAutoPostDate = result.localDate;
      }
    }, autoPostIntervalMs)
  );

  if (options.config.resultSyncEnabled && options.config.footballDataToken) {
    intervals.push(
      options.startInterval(async () => {
        const { localDate } = getLocalDateTimeParts(options.now(), options.config.timezone);

        await syncFinishedResults({
          enabled: options.config.resultSyncEnabled,
          token: options.config.footballDataToken,
          matches: options.matches,
          dateFrom: localDate,
          dateTo: localDate,
          now: options.now,
          listResults: () => options.store.listResults(),
          listPredictions: () => options.store.listPredictions(),
          upsertResult: (result) => options.store.upsertResult(result),
          insertScoringRun: (run) => options.store.insertScoringRun(run)
        });
      }, resultSyncIntervalMs)
    );
  }

  return intervals;
}

function hasDestroy(value: unknown): value is { destroy(): void | Promise<void> } {
  return typeof value === "object" && value !== null && "destroy" in value;
}
