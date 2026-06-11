import { scoreMatch, type ScorePrediction } from "../scoring/scoring.js";
import type { NewScoringRun, StoredResult } from "../storage/database.js";
import type { WorldCupMatch } from "../worldcup/types.js";
import {
  fetchFootballDataMatches,
  type FootballDataFetchResult,
  type FootballDataMatch
} from "./football-data.js";

export interface SyncFinishedResultsOptions {
  enabled: boolean;
  token: string | null;
  matches: WorldCupMatch[];
  dateFrom: string;
  dateTo: string;
  now(): Date;
  fetchMatches?(): Promise<FootballDataFetchResult>;
  listResults(): StoredResult[];
  listPredictions(): ScorePrediction[];
  upsertResult(result: StoredResult): void | Promise<void>;
  insertScoringRun(run: NewScoringRun): unknown;
}

export type SyncFinishedResultsResult =
  | { action: "disabled"; reason: "disabled" | "missing-token" }
  | { action: "failed"; reason: "rate-limited" | "unavailable" }
  | {
      action: "synced";
      storedResults: string[];
      skipped: string[];
      skippedDetails?: ResultSyncSkippedMatch[];
    };

export type ResultSyncSkipReason = "manual-result" | "not-final" | "missing-final-score";

export interface ResultSyncSkippedMatch {
  matchId: string;
  reason: ResultSyncSkipReason;
  providerStatus?: string;
}

export async function syncFinishedResults(
  options: SyncFinishedResultsOptions
): Promise<SyncFinishedResultsResult> {
  if (!options.enabled) {
    return { action: "disabled", reason: "disabled" };
  }

  if (!options.token) {
    return { action: "disabled", reason: "missing-token" };
  }

  const fetchResult = await fetchProviderMatches(options);

  if (!fetchResult.ok) {
    return { action: "failed", reason: fetchResult.reason };
  }

  const localMatchesByExternalId = matchByFootballDataId(options.matches);
  const manualResultMatchIds = new Set(
    options
      .listResults()
      .filter((result) => result.resultSource === "manual")
      .map((result) => result.matchId)
  );
  const fetchedAt = options.now().toISOString();
  const storedResults: StoredResult[] = [];
  const skippedDetails: ResultSyncSkippedMatch[] = [];

  for (const providerMatch of fetchResult.matches) {
    const localMatch = localMatchesByExternalId.get(providerMatch.externalMatchId);

    if (!localMatch) {
      continue;
    }

    if (manualResultMatchIds.has(localMatch.id)) {
      skippedDetails.push({ matchId: localMatch.id, reason: "manual-result" });
      continue;
    }

    const result = resultFromProviderMatch(localMatch.id, providerMatch, fetchedAt);

    if (result.action === "skipped") {
      skippedDetails.push(result.detail);
      continue;
    }

    await options.upsertResult(result.result);
    storedResults.push(result.result);
  }

  if (storedResults.length > 0) {
    options.insertScoringRun(scoringRun(fetchedAt, storedResults, options.listPredictions()));
  }

  return {
    action: "synced",
    storedResults: storedResults.map((result) => result.matchId),
    skipped: skippedDetails.map((detail) => detail.matchId),
    skippedDetails
  };
}

async function fetchProviderMatches(
  options: SyncFinishedResultsOptions
): Promise<FootballDataFetchResult> {
  if (options.fetchMatches) {
    return options.fetchMatches();
  }

  return fetchFootballDataMatches({
    token: options.token ?? "",
    dateFrom: options.dateFrom,
    dateTo: options.dateTo
  });
}

function matchByFootballDataId(matches: WorldCupMatch[]): Map<string, WorldCupMatch> {
  const mapped = new Map<string, WorldCupMatch>();

  for (const match of matches) {
    if (match.externalIds.footballData !== undefined) {
      mapped.set(String(match.externalIds.footballData), match);
    }
  }

  return mapped;
}

function resultFromProviderMatch(
  matchId: string,
  providerMatch: FootballDataMatch,
  fetchedAt: string
):
  | { action: "stored"; result: StoredResult }
  | { action: "skipped"; detail: ResultSyncSkippedMatch } {
  if (providerMatch.status !== "FINISHED") {
    return {
      action: "skipped",
      detail: { matchId, reason: "not-final", providerStatus: providerMatch.status }
    };
  }

  if (!providerMatch.fullTime) {
    return {
      action: "skipped",
      detail: { matchId, reason: "missing-final-score", providerStatus: providerMatch.status }
    };
  }

  return {
    action: "stored",
    result: {
      matchId,
      homeScore: providerMatch.fullTime.homeScore,
      awayScore: providerMatch.fullTime.awayScore,
      recordedAt: fetchedAt,
      resultSource: "football-data",
      externalMatchId: providerMatch.externalMatchId,
      fetchedAt
    }
  };
}

function scoringRun(
  createdAt: string,
  storedResults: StoredResult[],
  predictions: ScorePrediction[]
): NewScoringRun {
  const scoredPredictions = storedResults.flatMap((result) => scoreMatch(result, predictions));

  return {
    createdAt,
    matchId: null,
    summary: {
      storedResults: storedResults.map((result) => result.matchId),
      scoredPredictions: scoredPredictions.length
    }
  };
}
