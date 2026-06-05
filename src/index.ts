import { pathToFileURL } from "node:url";

import { createPredictionPersistenceHandler } from "./app/collector.js";
import { loadLocalEnvFile } from "./config/env.js";
import { parseCopanalhasConfig, type CopanalhasConfig } from "./discord/config.js";
import { startDiscordClient } from "./discord/ingestion.js";
import type { PredictionInteractionOptions } from "./discord/interactions.js";
import { formatLeaderboard } from "./leaderboard/format.js";
import { buildLeaderboard, scoreMatch, type MatchResult, type ScorePrediction } from "./scoring/scoring.js";
import {
  openCopanalhasDatabase,
  type StoredPrediction,
  type StoredResult
} from "./storage/database.js";
import { WORLD_CUP_2026_SEED } from "./worldcup/seed.js";
import type { WorldCupMatch } from "./worldcup/types.js";

export interface CliStore {
  migrate(): void;
  upsertMatches(matches: WorldCupMatch[]): void;
  upsertPrediction(prediction: StoredPrediction): void;
  upsertResult(result: StoredResult): void;
  listPredictions(): ScorePrediction[];
  listResults(): MatchResult[];
  close(): void;
}

export interface CliDependencies {
  openDatabase(path: string): CliStore;
  writeLine(line: string): void;
  env: Record<string, string | undefined>;
  startDiscord(
    config: CopanalhasConfig,
    onMessageResult: Parameters<typeof startDiscordClient>[1],
    predictionInteractionOptions?: PredictionInteractionOptions
  ): Promise<unknown>;
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

  if (command === "record-result") {
    recordResult(argv, dependencies);
    return;
  }

  if (command === "leaderboard") {
    printLeaderboard(dependencies);
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
      recordedAt: new Date().toISOString()
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
  store.migrate();
  store.upsertMatches(WORLD_CUP_2026_SEED.matches);
  dependencies.writeLine("Starting Discord collector for configured channel.");

  await dependencies.startDiscord(
    configResult.config,
    createPredictionPersistenceHandler({
      matches: WORLD_CUP_2026_SEED.matches,
      upsertPrediction: (prediction) => store.upsertPrediction(prediction),
      writeLine: dependencies.writeLine
    }),
    {
      guildId: configResult.config.guildId,
      channelId: configResult.config.channelId,
      matches: WORLD_CUP_2026_SEED.matches,
      upsertPrediction: (prediction) => store.upsertPrediction(prediction)
    }
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
    startDiscord: startDiscordClient
  };
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

function usage(): string {
  return "Usage: npm run dev -- seed-matches | record-result <matchId> <homeScore> <awayScore> | leaderboard | bot";
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
