import { pathToFileURL } from "node:url";
import type { Buffer } from "node:buffer";
import { resolve } from "node:path";

import {
  startCopanalhasBotRuntime,
  type BotRuntimeStore,
  type RuntimeInterval
} from "./app/bot-runtime.js";
import { formatRuntimeAsyncErrorLog, formatRuntimeLogLine } from "./app/dev-log.js";
import type { MatchStartAlertMessage } from "./app/match-start-alerts.js";
import { renderBracketPng } from "./bracket/png.js";
import type { BracketDashboardMessage } from "./bracket/format.js";
import { renderChaosDashboardPng } from "./chaos-dashboard/png.js";
import type { ChaosDashboardMessage } from "./chaos-dashboard/format.js";
import { createCodexRecapCopyProvider } from "./chaos-dashboard/codex-copy.js";
import type { GenerateChaosRecapCopy } from "./chaos-dashboard/recap-copy.js";
import { loadLocalEnvFile } from "./config/env.js";
import { createMatchDayMessage, type MatchCardMessage } from "./discord/components.js";
import { parseCopanalhasConfig, type CopanalhasConfig } from "./discord/config.js";
import {
  fetchDiscordDisplayNames,
  fetchDiscordUserAvatarDataUris
} from "./discord/display-names.js";
import {
  startDiscordClient,
  type DiscordClientReadyOptions,
  type DiscordIngestionResult
} from "./discord/ingestion.js";
import {
  deleteDiscordMatchStartAlert,
  postDiscordMatchCards,
  postDiscordMatchStartAlert
} from "./discord/posting.js";
import {
  editDiscordPredictionReveal,
  postDiscordPredictionReveal,
  type PredictionRevealThreadMessage
} from "./discord/prediction-reveal-posting.js";
import type { PredictionResultThreadMessage } from "./app/prediction-result-posting.js";
import { upsertDiscordStandingsMessage } from "./discord/standings-posting.js";
import { formatLeaderboard } from "./leaderboard/format.js";
import { renderLeaderboardPng } from "./leaderboard/png.js";
import { buildLeaderboard, scoreMatch } from "./scoring/scoring.js";
import {
  createStandingsDashboardMessages,
  type StandingsDashboardMessage
} from "./standings/format.js";
import { computeGroupStandings, type StandingsResult } from "./standings/standings.js";
import { upsertDiscordLeaderboardMessage } from "./discord/leaderboard-posting.js";
import { upsertDiscordBracketMessage } from "./discord/bracket-posting.js";
import { upsertDiscordChaosDashboardMessage } from "./discord/chaos-dashboard-posting.js";
import type { LeaderboardDashboardMessage } from "./leaderboard/format.js";
import { openCopanalhasDatabase } from "./storage/database.js";
import { getMatchdayDateForInstant, isMatchOnMatchday } from "./worldcup/matchday.js";
import { WORLD_CUP_2026_SEED } from "./worldcup/seed.js";

export interface CliStore extends BotRuntimeStore {
  close(): void;
}

export interface CliDependencies {
  openDatabase(path: string): CliStore;
  writeLine(line: string): void;
  env: Record<string, string | undefined>;
  startDiscord(
    config: CopanalhasConfig,
    onMessageResult: (result: DiscordIngestionResult) => void | Promise<void>,
    predictionInteractionOptions: Parameters<typeof startDiscordClient>[2],
    readyOptions: DiscordClientReadyOptions
  ): Promise<unknown>;
  startInterval?(callback: () => void | Promise<void>, intervalMs: number): RuntimeInterval;
  sendMatchCard?(message: MatchCardMessage): Promise<string>;
  sendPredictionReveal?(message: PredictionRevealThreadMessage): Promise<{
    threadId: string;
    messageId: string;
  }>;
  editPredictionReveal?(message: PredictionResultThreadMessage): Promise<void>;
  sendMatchStartAlert?(message: MatchStartAlertMessage): Promise<string>;
  deleteMatchStartAlert?(messageId: string): Promise<void>;
  upsertStandingsMessage?(
    message: StandingsDashboardMessage,
    existingMessageId: string | null
  ): Promise<string>;
  upsertLeaderboardMessage?(
    message: LeaderboardDashboardMessage,
    existingMessageId: string | null
  ): Promise<string>;
  renderLeaderboardPng?(svg: string): Promise<Buffer>;
  upsertBracketMessage?(
    message: BracketDashboardMessage,
    existingMessageId: string | null
  ): Promise<string>;
  renderBracketPng?(svg: string): Promise<Buffer>;
  upsertChaosDashboardMessage?(
    message: ChaosDashboardMessage,
    existingMessageId: string | null
  ): Promise<string>;
  renderChaosDashboardPng?(svg: string): Promise<Buffer>;
  generateChaosRecapCopy?: GenerateChaosRecapCopy;
  resolveDiscordDisplayNames?(
    config: CopanalhasConfig,
    userIds: readonly string[]
  ): Promise<ReadonlyMap<string, string>>;
  resolveDiscordAvatarDataUris?(
    config: CopanalhasConfig,
    userIds: readonly string[]
  ): Promise<ReadonlyMap<string, string>>;
  now?(): Date;
  postMatchCards?(config: CopanalhasConfig, messages: MatchCardMessage[]): Promise<unknown>;
}

export async function runCli(
  argv: string[],
  dependencies: CliDependencies = defaultDependencies()
): Promise<void> {
  const [command] = argv;

  if (command === "seed-matches") {
    seedMatches(dependencies);
    return;
  }

  if (command === "post-matches-today") {
    await postMatchesToday(argv, dependencies);
    return;
  }

  if (command === "clear-posted-date") {
    clearPostedDate(argv, dependencies);
    return;
  }

  if (command === "record-result") {
    recordResult(argv, dependencies);
    return;
  }

  if (command === "leaderboard") {
    printLeaderboard(dependencies);
    return;
  }

  if (command === "standings-preview") {
    printStandingsPreview(dependencies);
    return;
  }

  if (command === "bot") {
    await startBot(dependencies);
    return;
  }

  dependencies.writeLine(usage());
}

function seedMatches(dependencies: CliDependencies): void {
  const store = dependencies.openDatabase(databasePathFromEnv(dependencies.env));

  try {
    store.migrate();
    store.upsertMatches(WORLD_CUP_2026_SEED.matches);
    dependencies.writeLine(`Seeded ${WORLD_CUP_2026_SEED.matches.length} World Cup matches.`);
  } finally {
    store.close();
  }
}

async function postMatchesToday(argv: string[], dependencies: CliDependencies): Promise<void> {
  const dateArg = argv[1]?.trim();

  if (dateArg && !isDateString(dateArg)) {
    dependencies.writeLine(usage());
    return;
  }

  const configResult = parseCopanalhasConfig(dependencies.env);

  if (!configResult.ok) {
    for (const error of configResult.errors) {
      dependencies.writeLine(error);
    }
    return;
  }

  const date =
    dateArg ||
    getMatchdayDateForInstant(
      dependencies.now?.() ?? new Date(),
      configResult.config.timezone,
      configResult.config.matchdayRolloverTime
    );
  const matches = WORLD_CUP_2026_SEED.matches.filter((match) =>
    isMatchOnMatchday(
      match,
      date,
      configResult.config.timezone,
      configResult.config.matchdayRolloverTime
    )
  );

  if (matches.length === 0) {
    dependencies.writeLine(`No reviewed World Cup matches found for ${date}.`);
    return;
  }

  const postMatchCards = dependencies.postMatchCards ?? postDiscordMatchCards;
  await postMatchCards(configResult.config, [
    createMatchDayMessage(matches, {
      date,
      timeZone: configResult.config.timezone
    })
  ]);
  dependencies.writeLine(`Posted 1 matchday card for ${matches.length} matches on ${date}.`);
}

function recordResult(argv: string[], dependencies: CliDependencies): void {
  const [, matchId, homeScoreText, awayScoreText] = argv;
  const homeScore = parseScore(homeScoreText);
  const awayScore = parseScore(awayScoreText);

  if (!matchId || homeScore === undefined || awayScore === undefined) {
    dependencies.writeLine(usage());
    return;
  }

  const store = dependencies.openDatabase(databasePathFromEnv(dependencies.env));

  try {
    store.migrate();
    store.upsertResult({
      matchId,
      homeScore,
      awayScore,
      recordedAt: new Date().toISOString(),
      resultSource: "manual",
      externalMatchId: null,
      fetchedAt: null
    });
    dependencies.writeLine(`Recorded result ${matchId} ${homeScore}-${awayScore}.`);
  } finally {
    store.close();
  }
}

function clearPostedDate(argv: string[], dependencies: CliDependencies): void {
  const date = dateFromOptionalArg(argv[1]);

  if (!date) {
    dependencies.writeLine(usage());
    return;
  }

  const channelId = dependencies.env.DISCORD_CHANNEL_ID?.trim();

  if (!channelId) {
    dependencies.writeLine("DISCORD_CHANNEL_ID is required");
    return;
  }

  const store = dependencies.openDatabase(databasePathFromEnv(dependencies.env));

  try {
    store.migrate();
    const cleared = store.clearPostedMatchCardsForDate(channelId, date);
    dependencies.writeLine(
      `Cleared ${cleared} posted match card records for ${date}. Predictions, results, and standings were not touched.`
    );
  } finally {
    store.close();
  }
}

function printLeaderboard(dependencies: CliDependencies): void {
  const databasePath = dependencies.env.COPANALHAS_DATABASE_PATH?.trim() || "./data/copanalhas.sqlite";
  const store = dependencies.openDatabase(databasePath);

  try {
    store.migrate();
    const predictions = store.listPredictions();
    const results = store.listResults();
    const scoredPredictions = results.flatMap((result) => scoreMatch(result, predictions));

    dependencies.writeLine(formatLeaderboard(buildLeaderboard(scoredPredictions, predictions)));
  } finally {
    store.close();
  }
}

async function startBot(dependencies: CliDependencies): Promise<void> {
  const configResult = parseCopanalhasConfig(dependencies.env);

  if (!configResult.ok) {
    for (const error of configResult.errors) {
      dependencies.writeLine(error);
    }
    return;
  }

  const store = dependencies.openDatabase(configResult.config.databasePath);
  const now = dependencies.now ?? (() => new Date());
  const writeBotLine = (line: string) => dependencies.writeLine(formatRuntimeLogLine(now(), line));
  const generateChaosRecapCopy =
    dependencies.generateChaosRecapCopy ??
    (configResult.config.recapCodexEnabled
      ? createCodexRecapCopyProvider({
          command: configResult.config.recapCodexCommand,
          outputDir: resolve(configResult.config.recapCodexOutputDir),
          schemaPath: resolve("src", "chaos-dashboard", "recap-copy.schema.json"),
          timeoutMs: configResult.config.recapCodexTimeoutMs
        })
      : undefined);

  writeBotLine("Starting Discord collector for configured channel.");

  await startCopanalhasBotRuntime({
    config: configResult.config,
    store,
    matches: WORLD_CUP_2026_SEED.matches,
    startDiscord: dependencies.startDiscord,
    startInterval: dependencies.startInterval ?? startNodeInterval,
    sendMatchCard:
      dependencies.sendMatchCard ??
      ((message) => sendDiscordMatchCard(configResult.config, message)),
    sendPredictionReveal:
      dependencies.sendPredictionReveal ??
      ((message) => postDiscordPredictionReveal(configResult.config, message)),
    editPredictionReveal:
      dependencies.editPredictionReveal ??
      ((message) => editDiscordPredictionReveal(configResult.config, message)),
    sendMatchStartAlert:
      dependencies.sendMatchStartAlert ??
      ((message) => postDiscordMatchStartAlert(configResult.config, message)),
    deleteMatchStartAlert:
      dependencies.deleteMatchStartAlert ??
      ((messageId) => deleteDiscordMatchStartAlert(configResult.config, messageId)),
    upsertStandingsMessage:
      dependencies.upsertStandingsMessage ??
      ((message, existingMessageId) =>
        upsertDiscordStandingsMessage(configResult.config, message, existingMessageId)),
    upsertLeaderboardMessage:
      dependencies.upsertLeaderboardMessage ??
      ((message, existingMessageId) =>
        upsertDiscordLeaderboardMessage(configResult.config, message, existingMessageId)),
    renderLeaderboardPng: dependencies.renderLeaderboardPng ?? renderLeaderboardPng,
    upsertBracketMessage:
      dependencies.upsertBracketMessage ??
      ((message, existingMessageId) =>
        upsertDiscordBracketMessage(configResult.config, message, existingMessageId)),
    renderBracketPng: dependencies.renderBracketPng ?? renderBracketPng,
    upsertChaosDashboardMessage:
      dependencies.upsertChaosDashboardMessage ??
      ((message, existingMessageId) =>
        upsertDiscordChaosDashboardMessage(configResult.config, message, existingMessageId)),
    renderChaosDashboardPng:
      dependencies.renderChaosDashboardPng ?? renderChaosDashboardPng,
    resolveUserDisplayNames: (userIds) =>
      (dependencies.resolveDiscordDisplayNames ?? fetchDiscordDisplayNames)(
        configResult.config,
        userIds
      ),
    resolveUserAvatarDataUris: (userIds) =>
      (dependencies.resolveDiscordAvatarDataUris ?? fetchDiscordUserAvatarDataUris)(
        configResult.config,
        userIds
      ),
    ...(generateChaosRecapCopy ? { generateChaosRecapCopy } : {}),
    now,
    writeLine: dependencies.writeLine
  });
  writeBotLine(
    `Autonomous operator enabled. Auto-post: ${
      configResult.config.autoPostEnabled
        ? `on at ${configResult.config.autoPostTime} ${configResult.config.timezone}`
        : "off"
    }.`
  );
}

export function main(): void {
  void runCli(process.argv.slice(2)).catch((error: unknown) => {
    logUnhandledCliError(error);
    process.exitCode = 1;
  });
}

export function logUnhandledCliError(
  error: unknown,
  options: { now(): Date; writeLine(line: string): void } = {
    now: () => new Date(),
    writeLine: (line) => console.error(line)
  }
): void {
  options.writeLine(
    formatRuntimeLogLine(
      options.now(),
      formatRuntimeAsyncErrorLog({ scope: "cli", error })
    )
  );
}

function defaultDependencies(): CliDependencies {
  loadLocalEnvFile();

  return {
    openDatabase: openCopanalhasDatabase,
    writeLine: (line) => console.log(line),
    env: process.env,
    startDiscord: startDiscordClient,
    startInterval: startNodeInterval,
    postMatchCards: postDiscordMatchCards
  };
}

function printStandingsPreview(dependencies: CliDependencies): void {
  const messages = createStandingsDashboardMessages({
    standings: computeGroupStandings(WORLD_CUP_2026_SEED.matches, firstDayPreviewResults()),
    updatedAt: new Date("2026-06-11T23:30:00.000Z"),
    timeZone: "UTC"
  });

  for (const message of messages) {
    dependencies.writeLine(message.content);

    for (const embed of message.embeds) {
      dependencies.writeLine(embed.title);

      if (embed.description) {
        dependencies.writeLine(embed.description);
      }
    }
  }
}

function firstDayPreviewResults(): StandingsResult[] {
  return [
    {
      matchId: "wc2026-001",
      homeScore: 2,
      awayScore: 1
    },
    {
      matchId: "wc2026-002",
      homeScore: 1,
      awayScore: 1
    }
  ];
}

export function startNodeInterval(
  callback: () => void | Promise<void>,
  intervalMs: number,
  now: () => Date = () => new Date()
): RuntimeInterval {
  const handle = setInterval(() => {
    void Promise.resolve(callback()).catch((error: unknown) => {
      console.error(
        formatRuntimeLogLine(
          now(),
          formatRuntimeAsyncErrorLog({ scope: "interval", error })
        )
      );
    });
  }, intervalMs);

  return {
    stop: () => clearInterval(handle)
  };
}

async function sendDiscordMatchCard(
  config: CopanalhasConfig,
  message: MatchCardMessage
): Promise<string> {
  const [messageId] = await postDiscordMatchCards(config, [message]);

  if (!messageId) {
    throw new Error("Discord did not return a message id for the posted match card.");
  }

  return messageId;
}

function databasePathFromEnv(env: Record<string, string | undefined>): string {
  return env.COPANALHAS_DATABASE_PATH?.trim() || "./data/copanalhas.sqlite";
}

function parseScore(value: string | undefined): number | undefined {
  if (!value || !/^\d+$/u.test(value)) {
    return undefined;
  }

  return Number.parseInt(value, 10);
}

function dateFromOptionalArg(value: string | undefined): string | undefined {
  const date = value?.trim() || new Date().toISOString().slice(0, 10);

  if (!isDateString(date)) {
    return undefined;
  }

  return date;
}

function isDateString(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(date)) {
    return false;
  }

  return true;
}

function usage(): string {
  return "Usage: npm run dev -- seed-matches | post-matches-today [YYYY-MM-DD] | clear-posted-date [YYYY-MM-DD] | record-result <matchId> <homeScore> <awayScore> | leaderboard | standings-preview | bot";
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
