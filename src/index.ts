import { pathToFileURL } from "node:url";

import {
  startCopanalhasBotRuntime,
  type BotRuntimeStore,
  type RuntimeInterval
} from "./app/bot-runtime.js";
import { loadLocalEnvFile } from "./config/env.js";
import { createMatchCardMessage, type MatchCardMessage } from "./discord/components.js";
import { parseCopanalhasConfig, type CopanalhasConfig } from "./discord/config.js";
import {
  startDiscordClient,
  type DiscordClientReadyOptions,
  type DiscordIngestionResult
} from "./discord/ingestion.js";
import { postDiscordMatchCards } from "./discord/posting.js";
import { upsertDiscordStandingsMessage } from "./discord/standings-posting.js";
import { formatLeaderboard } from "./leaderboard/format.js";
import { buildLeaderboard, scoreMatch } from "./scoring/scoring.js";
import {
  createStandingsDashboardMessages,
  type StandingsDashboardMessage
} from "./standings/format.js";
import { computeGroupStandings, type StandingsResult } from "./standings/standings.js";
import { openCopanalhasDatabase } from "./storage/database.js";
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
    onMessageResult: (result: DiscordIngestionResult) => void,
    predictionInteractionOptions: Parameters<typeof startDiscordClient>[2],
    readyOptions: DiscordClientReadyOptions
  ): Promise<unknown>;
  startInterval?(callback: () => void | Promise<void>, intervalMs: number): RuntimeInterval;
  sendMatchCard?(matchId: string, message: MatchCardMessage): Promise<string>;
  upsertStandingsMessage?(
    message: StandingsDashboardMessage,
    existingMessageId: string | null
  ): Promise<string>;
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
  const date = dateFromOptionalArg(argv[1]);

  if (!date) {
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

  const matches = WORLD_CUP_2026_SEED.matches.filter((match) => match.localDate === date);

  if (matches.length === 0) {
    dependencies.writeLine(`No reviewed World Cup matches found for ${date}.`);
    return;
  }

  const postMatchCards = dependencies.postMatchCards ?? postDiscordMatchCards;
  await postMatchCards(
    configResult.config,
    matches.map((match) =>
      createMatchCardMessage(match, { timeZone: configResult.config.timezone })
    )
  );
  dependencies.writeLine(`Posted ${matches.length} match cards for ${date}.`);
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

function printLeaderboard(dependencies: CliDependencies): void {
  const databasePath = dependencies.env.COPANALHAS_DATABASE_PATH?.trim() || "./data/copanalhas.sqlite";
  const store = dependencies.openDatabase(databasePath);

  try {
    store.migrate();
    const predictions = store.listPredictions();
    const results = store.listResults();
    const scoredPredictions = results.flatMap((result) => scoreMatch(result, predictions));

    dependencies.writeLine(formatLeaderboard(buildLeaderboard(scoredPredictions)));
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
  dependencies.writeLine("Starting Discord collector for configured channel.");

  await startCopanalhasBotRuntime({
    config: configResult.config,
    store,
    matches: WORLD_CUP_2026_SEED.matches,
    startDiscord: dependencies.startDiscord,
    startInterval: dependencies.startInterval ?? startNodeInterval,
    sendMatchCard:
      dependencies.sendMatchCard ??
      ((matchId, message) => sendDiscordMatchCard(configResult.config, matchId, message)),
    upsertStandingsMessage:
      dependencies.upsertStandingsMessage ??
      ((message, existingMessageId) =>
        upsertDiscordStandingsMessage(configResult.config, message, existingMessageId)),
    now: dependencies.now ?? (() => new Date()),
    writeLine: dependencies.writeLine
  });
  dependencies.writeLine(
    `Autonomous operator enabled. Auto-post: ${
      configResult.config.autoPostEnabled
        ? `on at ${configResult.config.autoPostTime} ${configResult.config.timezone}`
        : "off"
    }.`
  );
}

export function main(): void {
  void runCli(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
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

function startNodeInterval(
  callback: () => void | Promise<void>,
  intervalMs: number
): RuntimeInterval {
  const handle = setInterval(() => {
    void Promise.resolve(callback()).catch((error: unknown) => {
      console.error(error);
    });
  }, intervalMs);

  return {
    stop: () => clearInterval(handle)
  };
}

async function sendDiscordMatchCard(
  config: CopanalhasConfig,
  _matchId: string,
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

  if (!/^\d{4}-\d{2}-\d{2}$/u.test(date)) {
    return undefined;
  }

  return date;
}

function usage(): string {
  return "Usage: npm run dev -- seed-matches | post-matches-today [YYYY-MM-DD] | record-result <matchId> <homeScore> <awayScore> | leaderboard | standings-preview | bot";
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
