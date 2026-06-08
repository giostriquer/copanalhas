import type { UpdateLeaderboardDashboardResult } from "./leaderboard-posting.js";
import type { UpdateStandingsDashboardResult } from "./standings-posting.js";
import type {
  OperatorAutocompleteInput,
  OperatorAutocompleteResult,
  OperatorCommandInput,
  OperatorCommandResult,
  RuntimeAutoPostStatus,
  RuntimeResultSyncStatus
} from "../discord/operator-commands.js";
import type { PredictionInteractionResult } from "../discord/interactions.js";

export function formatOperatorCommandLog(
  input: OperatorCommandInput,
  result: OperatorCommandResult
): string {
  return [
    "[operator]",
    `subcommand=${input.subcommand}`,
    `user=${formatNullable(input.userId)}`,
    `guild=${formatNullable(input.guildId)}`,
    `channel=${formatNullable(input.channelId)}`,
    `options=${formatOptions(input.options)}`,
    "->",
    formatOperatorCommandResult(result)
  ].join(" ");
}

export function formatOperatorAutocompleteLog(
  input: OperatorAutocompleteInput,
  result: OperatorAutocompleteResult
): string {
  return [
    "[autocomplete]",
    `subcommand=${input.subcommand}`,
    `option=${safeLogValue(input.focusedOptionName)}`,
    `value=${safeLogValue(input.focusedValue)}`,
    `user=${formatNullable(input.userId)}`,
    `guild=${formatNullable(input.guildId)}`,
    `channel=${formatNullable(input.channelId)}`,
    "->",
    formatAutocompleteResult(result)
  ].join(" ");
}

export function formatPredictionInteractionLog(result: PredictionInteractionResult): string {
  if (result.action === "ignored") {
    return `[prediction] ignored reason=${result.reason}`;
  }

  if (result.action === "opened-modal") {
    return `[prediction] opened-modal match=${result.matchId}`;
  }

  if (result.action === "accepted") {
    return [
      "[prediction] accepted",
      `user=${result.prediction.userId}`,
      `match=${result.prediction.matchId}`,
      `score=${result.prediction.homeScore}-${result.prediction.awayScore}`,
      `message=${result.prediction.messageId}`
    ].join(" ");
  }

  return [
    "[prediction] rejected",
    `reason=${result.reason}`,
    `user=${result.userId}`,
    `match=${result.matchId}`,
    result.reason === "closed" ? `closesAt=${result.closesAtUtc}` : null
  ]
    .filter((part): part is string => part !== null)
    .join(" ");
}

export function formatAutoPostLog(result: RuntimeAutoPostStatus): string {
  if (result.action === "never") {
    return "[auto-post] never";
  }

  if (result.action === "disabled") {
    return "[auto-post] disabled";
  }

  if (result.action === "not-due") {
    return `[auto-post] date=${result.localDate} time=${result.localTime} not-due`;
  }

  return `[auto-post] date=${result.localDate} posted=${result.posted.length} skipped=${result.skipped.length}`;
}

export function formatResultSyncLog(result: RuntimeResultSyncStatus): string {
  if (result.action === "never") {
    return "[result-sync] never";
  }

  if (result.action === "disabled") {
    return `[result-sync] disabled reason=${result.reason}`;
  }

  if (result.action === "not-due") {
    return `[result-sync] not-due pending=${result.pendingMatchIds.length}${
      result.nextCheckAtUtc ? ` next=${result.nextCheckAtUtc}` : ""
    }`;
  }

  if (result.action === "failed") {
    return `[result-sync] range=${result.dateFrom}..${result.dateTo} failed reason=${result.reason}`;
  }

  return `[result-sync] range=${result.dateFrom}..${result.dateTo} synced stored=${result.storedResults.length} skipped=${result.skipped.length}`;
}

export function formatStandingsDashboardLog(result: UpdateStandingsDashboardResult): string {
  const counts = countDashboardActions(result.posts.map((post) => post.action));

  return [
    "[dashboard] standings",
    `posts=${result.posts.length}`,
    `posted=${counts.posted}`,
    `edited=${counts.edited}`,
    `replaced=${counts.replaced}`
  ].join(" ");
}

export function formatLeaderboardDashboardLog(result: UpdateLeaderboardDashboardResult): string {
  return `[dashboard] leaderboard action=${result.post.action} message=${result.post.messageId}`;
}

function formatOperatorCommandResult(result: OperatorCommandResult): string {
  if (result.action === "ignored") {
    return `ignored reason=${result.reason}`;
  }

  return `replied ephemeral=${result.ephemeral}`;
}

function formatAutocompleteResult(result: OperatorAutocompleteResult): string {
  if (result.action === "ignored") {
    return `ignored reason=${result.reason}`;
  }

  return `responded choices=${result.choices.length}`;
}

function formatOptions(options: Record<string, string>): string {
  const entries = Object.entries(options).toSorted(([left], [right]) => left.localeCompare(right));

  if (entries.length === 0) {
    return "none";
  }

  return entries.map(([key, value]) => `${safeLogValue(key)}:${safeLogValue(value)}`).join(",");
}

function formatNullable(value: string | null): string {
  return value === null ? "null" : safeLogValue(value);
}

function safeLogValue(value: string): string {
  const normalized = value.trim().replace(/\s+/gu, "_");

  if (normalized === "") {
    return "empty";
  }

  return normalized.length > 80 ? `${normalized.slice(0, 77)}...` : normalized;
}

function countDashboardActions(actions: Array<"posted" | "edited" | "replaced">): {
  posted: number;
  edited: number;
  replaced: number;
} {
  return {
    posted: actions.filter((action) => action === "posted").length,
    edited: actions.filter((action) => action === "edited").length,
    replaced: actions.filter((action) => action === "replaced").length
  };
}
