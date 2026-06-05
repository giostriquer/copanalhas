import { pathToFileURL } from "node:url";

import { formatLeaderboard } from "./leaderboard/format.js";
import { buildLeaderboard, scoreMatch, type MatchResult, type ScorePrediction } from "./scoring/scoring.js";
import { openCopanalhasDatabase } from "./storage/database.js";

export interface CliStore {
  migrate(): void;
  listPredictions(): ScorePrediction[];
  listResults(): MatchResult[];
  close(): void;
}

export interface CliDependencies {
  openDatabase(path: string): CliStore;
  writeLine(line: string): void;
  env: Record<string, string | undefined>;
}

export function runCli(
  argv: string[],
  dependencies: CliDependencies = defaultDependencies()
): void {
  const [command] = argv;

  if (command !== "leaderboard") {
    dependencies.writeLine("Usage: npm run dev -- leaderboard");
    return;
  }

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

export function main(): void {
  runCli(process.argv.slice(2));
}

function defaultDependencies(): CliDependencies {
  return {
    openDatabase: openCopanalhasDatabase,
    writeLine: (line) => console.log(line),
    env: process.env
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
