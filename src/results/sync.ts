import { scoreMatch, type MatchWinner, type ScorePrediction } from "../scoring/scoring.js";
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
  pendingMatchIds?: readonly string[];
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

export type ResultSyncSkipReason =
  | "manual-result"
  | "not-final"
  | "missing-final-score"
  | "missing-knockout-detail";

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

  const syncMatches = matchesForSync(options.matches, options.pendingMatchIds);
  const fetchResult = await fetchProviderMatches(options, syncMatches);

  if (!fetchResult.ok) {
    return { action: "failed", reason: fetchResult.reason };
  }

  const localMatchesByExternalId = matchByFootballDataId(syncMatches);
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

    const result = resultFromProviderMatch(localMatch, providerMatch, fetchedAt);

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
  options: SyncFinishedResultsOptions,
  syncMatches: readonly WorldCupMatch[]
): Promise<FootballDataFetchResult> {
  if (options.fetchMatches) {
    return options.fetchMatches();
  }

  const externalMatchIds = syncMatches
    .map((match) => match.externalIds.footballData)
    .filter((externalId): externalId is number => externalId !== undefined)
    .map(String);

  if (externalMatchIds.length === 0) {
    return { ok: true, matches: [] };
  }

  return fetchFootballDataMatches({
    token: options.token ?? "",
    dateFrom: options.dateFrom,
    dateTo: options.dateTo,
    externalMatchIds
  });
}

function matchesForSync(
  matches: readonly WorldCupMatch[],
  pendingMatchIds: readonly string[] | undefined
): WorldCupMatch[] {
  if (!pendingMatchIds || pendingMatchIds.length === 0) {
    return [...matches];
  }

  const pending = new Set(pendingMatchIds);

  return matches.filter((match) => pending.has(match.id));
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
  localMatch: WorldCupMatch,
  providerMatch: FootballDataMatch,
  fetchedAt: string
):
  | { action: "stored"; result: StoredResult }
  | { action: "skipped"; detail: ResultSyncSkippedMatch } {
  const matchId = localMatch.id;

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

  if (localMatch.phase !== "group") {
    const knockoutResult = knockoutResultFromProviderMatch(localMatch, providerMatch, fetchedAt);

    if (knockoutResult) {
      return { action: "stored", result: knockoutResult };
    }

    return {
      action: "skipped",
      detail: {
        matchId,
        reason: "missing-knockout-detail",
        providerStatus: providerMatch.status
      }
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

function knockoutResultFromProviderMatch(
  localMatch: WorldCupMatch,
  providerMatch: FootballDataMatch,
  fetchedAt: string
): StoredResult | undefined {
  const fullTime = providerMatch.fullTime;

  if (!fullTime || !providerMatch.decisionMethod) {
    return undefined;
  }

  if (providerMatch.decisionMethod === "regular") {
    const regularTime = providerMatch.regularTime ?? fullTime;
    const winner = providerMatch.winner ?? winnerFromScore(regularTime);

    if (!winner) {
      return undefined;
    }

    return {
      ...baseStoredResult(localMatch.id, fullTime, providerMatch, fetchedAt),
      decisionMethod: "regular",
      regularTimeHomeScore: regularTime.homeScore,
      regularTimeAwayScore: regularTime.awayScore,
      winner
    };
  }

  if (providerMatch.decisionMethod === "extra_time") {
    if (!providerMatch.regularTime || !providerMatch.extraTime) {
      return undefined;
    }

    const winner = providerMatch.winner ?? winnerFromScore(providerMatch.extraTime);

    if (!winner) {
      return undefined;
    }

    return {
      ...baseStoredResult(localMatch.id, fullTime, providerMatch, fetchedAt),
      decisionMethod: "extra_time",
      regularTimeHomeScore: providerMatch.regularTime.homeScore,
      regularTimeAwayScore: providerMatch.regularTime.awayScore,
      extraTimeHomeScore: providerMatch.extraTime.homeScore,
      extraTimeAwayScore: providerMatch.extraTime.awayScore,
      winner
    };
  }

  if (
    !providerMatch.regularTime ||
    !providerMatch.extraTime ||
    !providerMatch.penalties
  ) {
    return undefined;
  }

  const winner = providerMatch.winner ?? winnerFromScore(providerMatch.penalties);

  if (!winner) {
    return undefined;
  }

  return {
    ...baseStoredResult(localMatch.id, fullTime, providerMatch, fetchedAt),
    decisionMethod: "penalties",
    regularTimeHomeScore: providerMatch.regularTime.homeScore,
    regularTimeAwayScore: providerMatch.regularTime.awayScore,
    extraTimeHomeScore: providerMatch.extraTime.homeScore,
    extraTimeAwayScore: providerMatch.extraTime.awayScore,
    penaltyHomeScore: providerMatch.penalties.homeScore,
    penaltyAwayScore: providerMatch.penalties.awayScore,
    winner
  };
}

function baseStoredResult(
  matchId: string,
  fullTime: { homeScore: number; awayScore: number },
  providerMatch: FootballDataMatch,
  fetchedAt: string
): StoredResult {
  return {
    matchId,
    homeScore: fullTime.homeScore,
    awayScore: fullTime.awayScore,
    recordedAt: fetchedAt,
    resultSource: "football-data",
    externalMatchId: providerMatch.externalMatchId,
    fetchedAt
  };
}

function winnerFromScore(score: { homeScore: number; awayScore: number }): MatchWinner | undefined {
  if (score.homeScore > score.awayScore) {
    return "home";
  }

  if (score.awayScore > score.homeScore) {
    return "away";
  }

  return undefined;
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
