import type { ResultSyncSkippedMatch } from "../results/sync.js";

export type OperatorHealthAutoPostStatus =
  | { action: "never" }
  | { action: "disabled" }
  | { action: "not-due"; localDate: string; localTime: string }
  | {
      action: "posted";
      localDate: string;
      windowDays: number;
      dates: Array<{ date: string; posted: string[]; skipped: string[] }>;
      posted: string[];
      skipped: string[];
    };

export type OperatorHealthResultSyncStatus =
  | { action: "never" }
  | { action: "disabled"; reason: "disabled" | "missing-token" }
  | { action: "not-due"; nextCheckAtUtc: string | null; pendingMatchIds: string[] }
  | { action: "due"; dateFrom: string; dateTo: string; pendingMatchIds: string[] }
  | { action: "failed"; dateFrom: string; dateTo: string; reason: "rate-limited" | "unavailable" }
  | {
      action: "synced";
      dateFrom: string;
      dateTo: string;
      storedResults: string[];
      skipped: string[];
      skippedDetails?: ResultSyncSkippedMatch[];
    };

export interface OperatorHealthMatchdayStatus {
  date: string;
  matchCount: number;
  postedCount: number;
}

export interface OperatorHealthPendingReveal {
  matchId: string;
  matchNumber: number;
  label: string;
}

export interface OperatorHealthSnapshot {
  discord: {
    online: boolean;
    guildId: string;
    channelId: string;
  };
  localDate: string;
  localTime: string;
  timeZone: string;
  autoPostEnabled: boolean;
  autoPostTime: string;
  autoPostWindowDays: number;
  nextMatchday: OperatorHealthMatchdayStatus | null;
  predictionWindows: {
    open: number;
    closed: number;
    missingKickoff: number;
  };
  pendingPredictionReveals: OperatorHealthPendingReveal[];
  footballDataConfigured: boolean;
  resultSyncEnabled: boolean;
  resultSyncPlan: OperatorHealthResultSyncStatus;
  lastAutoPost: OperatorHealthAutoPostStatus;
  lastResultSync: OperatorHealthResultSyncStatus;
  standingsPosts: {
    present: number;
    expected: number;
    lastUpdatedAt: string | null;
  };
  leaderboardPost: {
    present: boolean;
    lastUpdatedAt: string | null;
  };
  bracketPost: {
    present: boolean;
    lastUpdatedAt: string | null;
  };
  chaosDashboardPost: {
    present: boolean;
    lastUpdatedAt: string | null;
  };
  data: {
    matchesLoaded: number;
    missingKickoffTimes: number;
  };
}

export function formatOperatorHealthReport(snapshot: OperatorHealthSnapshot): string[] {
  return [
    "Copanalhas Health",
    `Discord: ${snapshot.discord.online ? "online" : "offline"}`,
    `Route: guild ${snapshot.discord.guildId}, channel ${snapshot.discord.channelId}`,
    `Local time: ${snapshot.localDate} ${snapshot.localTime} ${snapshot.timeZone}`,
    `Auto-post: ${snapshot.autoPostEnabled ? `on at ${snapshot.autoPostTime}` : "off"} ${
      snapshot.timeZone
    } (${snapshot.autoPostWindowDays} day window)`,
    `Next matchday post: ${formatNextMatchday(snapshot.nextMatchday)}`,
    `Prediction windows: ${snapshot.predictionWindows.open} open, ${snapshot.predictionWindows.closed} closed, ${snapshot.predictionWindows.missingKickoff} missing kickoff`,
    `Pending locked reveals: ${formatPendingReveals(snapshot.pendingPredictionReveals)}`,
    `Football Data: ${snapshot.footballDataConfigured ? "configured" : "missing token"}, result sync ${
      snapshot.resultSyncEnabled ? "on" : "off"
    }`,
    `Next result-sync check: ${formatNextResultSyncCheck(snapshot.resultSyncPlan)}`,
    `Last auto-post: ${formatLastAutoPost(snapshot.lastAutoPost)}`,
    `Last result sync: ${formatLastResultSync(snapshot.lastResultSync)}`,
    `Dashboards: standings ${snapshot.standingsPosts.present}/${snapshot.standingsPosts.expected}, leaderboard ${
      snapshot.leaderboardPost.present ? "present" : "missing"
    }, bracket ${snapshot.bracketPost.present ? "present" : "missing"}, chaos ${
      snapshot.chaosDashboardPost.present ? "present" : "missing"
    }`,
    `Last leaderboard update: ${snapshot.leaderboardPost.lastUpdatedAt ?? "never"}`,
    `Last bracket update: ${snapshot.bracketPost.lastUpdatedAt ?? "never"}`,
    `Last chaos update: ${snapshot.chaosDashboardPost.lastUpdatedAt ?? "never"}`,
    `Data: ${snapshot.data.matchesLoaded} matches loaded, ${snapshot.data.missingKickoffTimes} missing kickoff times`
  ];
}

export function formatOperatorHealthLogLines(snapshot: OperatorHealthSnapshot): string[] {
  return [
    `[health] discord=${snapshot.discord.online ? "online" : "offline"} guild=${
      snapshot.discord.guildId
    } channel=${snapshot.discord.channelId}`,
    `[health] local=${snapshot.localDate} ${snapshot.localTime} timezone=${
      snapshot.timeZone
    } autoPost=${snapshot.autoPostEnabled ? `on@${snapshot.autoPostTime}` : "off"} windowDays=${
      snapshot.autoPostWindowDays
    }`,
    `[health] nextMatchday=${formatNextMatchdayForLog(snapshot.nextMatchday)}`,
    `[health] predictions open=${snapshot.predictionWindows.open} closed=${
      snapshot.predictionWindows.closed
    } missingKickoff=${snapshot.predictionWindows.missingKickoff} pendingReveals=${
      snapshot.pendingPredictionReveals.length
    }`,
    `[health] footballData=${
      snapshot.footballDataConfigured ? "configured" : "missing-token"
    } resultSync=${snapshot.resultSyncEnabled ? "on" : "off"} ${formatResultSyncPlanForLog(
      snapshot.resultSyncPlan
    )}`,
    `[health] dashboards standings=${snapshot.standingsPosts.present}/${
      snapshot.standingsPosts.expected
    } leaderboard=${snapshot.leaderboardPost.present ? "present" : "missing"} bracket=${
      snapshot.bracketPost.present ? "present" : "missing"
    } chaos=${snapshot.chaosDashboardPost.present ? "present" : "missing"} lastLeaderboard=${
      snapshot.leaderboardPost.lastUpdatedAt ?? "never"
    } lastBracket=${snapshot.bracketPost.lastUpdatedAt ?? "never"} lastChaos=${
      snapshot.chaosDashboardPost.lastUpdatedAt ?? "never"
    }`
  ];
}

function formatNextMatchday(matchday: OperatorHealthMatchdayStatus | null): string {
  if (!matchday) {
    return "none scheduled";
  }

  return `${matchday.date} (${matchday.matchCount} ${count(
    matchday.matchCount,
    "match",
    "matches"
  )}, ${matchday.postedCount}/${matchday.matchCount} posted)`;
}

function formatNextMatchdayForLog(matchday: OperatorHealthMatchdayStatus | null): string {
  if (!matchday) {
    return "none matches=0 posted=0/0";
  }

  return `${matchday.date} matches=${matchday.matchCount} posted=${matchday.postedCount}/${matchday.matchCount}`;
}

function formatPendingReveals(reveals: readonly OperatorHealthPendingReveal[]): string {
  if (reveals.length === 0) {
    return "0";
  }

  const listed = reveals
    .slice(0, 5)
    .map((reveal) => `#${reveal.matchNumber} ${reveal.label}`)
    .join("; ");
  const overflow = reveals.length > 5 ? `; +${reveals.length - 5} more` : "";

  return `${reveals.length} (${listed}${overflow})`;
}

function formatNextResultSyncCheck(status: OperatorHealthResultSyncStatus): string {
  if (status.action === "disabled") {
    return `disabled (${status.reason})`;
  }

  if (status.action === "never") {
    return "not planned yet";
  }

  if (status.action === "not-due") {
    return status.nextCheckAtUtc
      ? `${status.nextCheckAtUtc} (${status.pendingMatchIds.length} pending)`
      : "none pending";
  }

  if (status.action === "due") {
    return `due now (${status.pendingMatchIds.length} pending)`;
  }

  if (status.action === "failed") {
    return `retry after failure (${status.reason})`;
  }

  return "recomputed after last sync";
}

function formatResultSyncPlanForLog(status: OperatorHealthResultSyncStatus): string {
  if (status.action === "disabled") {
    return `nextResultCheck=disabled reason=${status.reason} pendingResults=0`;
  }

  if (status.action === "never") {
    return "nextResultCheck=unplanned pendingResults=0";
  }

  if (status.action === "not-due") {
    return `nextResultCheck=${status.nextCheckAtUtc ?? "none"} pendingResults=${
      status.pendingMatchIds.length
    }`;
  }

  if (status.action === "due") {
    return `nextResultCheck=due pendingResults=${status.pendingMatchIds.length}`;
  }

  if (status.action === "failed") {
    return `nextResultCheck=retry reason=${status.reason} pendingResults=unknown`;
  }

  return "nextResultCheck=recompute pendingResults=unknown";
}

function formatLastAutoPost(status: OperatorHealthAutoPostStatus): string {
  if (status.action === "never") {
    return "never";
  }

  if (status.action === "disabled") {
    return "disabled";
  }

  if (status.action === "not-due") {
    return `not due at ${status.localDate} ${status.localTime}`;
  }

  return `posted ${status.posted.length}, skipped ${status.skipped.length} across ${status.windowDays} days from ${status.localDate}`;
}

function formatLastResultSync(status: OperatorHealthResultSyncStatus): string {
  if (status.action === "never") {
    return "never";
  }

  if (status.action === "disabled") {
    return `disabled (${status.reason})`;
  }

  if (status.action === "not-due") {
    return `waiting for ${status.pendingMatchIds.length} pending ${count(
      status.pendingMatchIds.length,
      "match",
      "matches"
    )}${status.nextCheckAtUtc ? `; next check ${status.nextCheckAtUtc}` : ""}`;
  }

  if (status.action === "due") {
    return `due for ${status.pendingMatchIds.length} pending ${count(
      status.pendingMatchIds.length,
      "match",
      "matches"
    )}`;
  }

  if (status.action === "failed") {
    return `failed ${status.reason} (${status.dateFrom} to ${status.dateTo})`;
  }

  return `synced ${status.storedResults.length}, skipped ${status.skipped.length} (${status.dateFrom} to ${status.dateTo})`;
}

function count(value: number, singular: string, plural: string): string {
  return value === 1 ? singular : plural;
}
