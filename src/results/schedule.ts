import type { StoredResult } from "../storage/database.js";
import type { WorldCupMatch } from "../worldcup/types.js";

export interface PlanResultSyncAttemptOptions {
  matches: readonly WorldCupMatch[];
  results: readonly Pick<StoredResult, "matchId">[];
  now: Date;
  firstCheckDelayMinutes: number;
  retryIntervalMinutes: number;
  lastAttemptAtUtc: string | null;
}

export type ResultSyncAttemptPlan =
  | { action: "not-due"; nextCheckAtUtc: string | null; pendingMatchIds: string[] }
  | { action: "due"; dateFrom: string; dateTo: string; pendingMatchIds: string[] };

interface PendingResultMatch {
  matchId: string;
  kickoffAtUtc: string;
  firstCheckAtMs: number;
}

export function planResultSyncAttempt(
  options: PlanResultSyncAttemptOptions
): ResultSyncAttemptPlan {
  const resolvedMatchIds = new Set(options.results.map((result) => result.matchId));
  const nowMs = options.now.getTime();
  const pendingMatches = options.matches
    .filter(
      (match) =>
        match.kickoffAtUtc !== null &&
        match.externalIds.footballData !== undefined &&
        !resolvedMatchIds.has(match.id)
    )
    .map((match): PendingResultMatch => {
      const kickoffMs = Date.parse(match.kickoffAtUtc ?? "");

      return {
        matchId: match.id,
        kickoffAtUtc: match.kickoffAtUtc ?? "",
        firstCheckAtMs: kickoffMs + minutesToMs(options.firstCheckDelayMinutes)
      };
    })
    .filter((match) => Number.isFinite(match.firstCheckAtMs))
    .toSorted((left, right) => left.firstCheckAtMs - right.firstCheckAtMs);

  if (pendingMatches.length === 0) {
    return { action: "not-due", nextCheckAtUtc: null, pendingMatchIds: [] };
  }

  const pendingMatchIds = pendingMatches.map((match) => match.matchId);
  const dueMatches = pendingMatches.filter((match) => match.firstCheckAtMs <= nowMs);

  if (dueMatches.length === 0) {
    return {
      action: "not-due",
      nextCheckAtUtc: new Date(pendingMatches[0]?.firstCheckAtMs ?? nowMs).toISOString(),
      pendingMatchIds
    };
  }

  const retryReadyAtMs =
    options.lastAttemptAtUtc === null
      ? null
      : Date.parse(options.lastAttemptAtUtc) + minutesToMs(options.retryIntervalMinutes);

  if (retryReadyAtMs !== null && retryReadyAtMs > nowMs) {
    return {
      action: "not-due",
      nextCheckAtUtc: new Date(retryReadyAtMs).toISOString(),
      pendingMatchIds
    };
  }

  const dueKickoffDates = dueMatches.map((match) => match.kickoffAtUtc.slice(0, 10)).sort();

  return {
    action: "due",
    dateFrom: dueKickoffDates[0] ?? options.now.toISOString().slice(0, 10),
    dateTo: dueKickoffDates.at(-1) ?? options.now.toISOString().slice(0, 10),
    pendingMatchIds: dueMatches.map((match) => match.matchId)
  };
}

function minutesToMs(minutes: number): number {
  return minutes * 60 * 1000;
}
