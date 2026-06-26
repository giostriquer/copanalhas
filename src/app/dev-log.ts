import type { UpdateLeaderboardDashboardResult } from "./leaderboard-posting.js";
import type { UpdateBracketDashboardResult } from "./bracket-posting.js";
import type { UpdateChaosDashboardResult } from "./chaos-dashboard-posting.js";
import type { UpdateStandingsDashboardResult } from "./standings-posting.js";
import type { UpdateThirdPlaceDashboardResult } from "./third-place-posting.js";
import type {
  OperatorAutocompleteInput,
  OperatorAutocompleteResult,
  OperatorCommandInput,
  OperatorCommandResult,
  RuntimeAutoPostStatus,
  RuntimeResultSyncStatus
} from "../discord/operator-commands.js";
import type { PredictionInteractionResult } from "../discord/interactions.js";
import type { ResultSyncSkippedMatch } from "../results/sync.js";

export function formatRuntimeLogLine(timestamp: Date, line: string): string {
  const match = /^\[([^\]\r\n]+)\]\s*(.*)$/u.exec(line);

  if (!match) {
    return `[${timestamp.toISOString()}][bot] ${line.trim()}`;
  }

  const [, category, rest] = match;

  return `[${timestamp.toISOString()}][${category}]${rest ? ` ${rest}` : ""}`;
}

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

export function formatDiscordAsyncErrorLog(input: {
  handler: string;
  error: unknown;
}): string {
  return [
    "[discord]",
    `handler=${safeLogValue(input.handler)}`,
    `message=${safeLogMessage(input.error)}`,
    formatErrorField(input.error, "code"),
    formatErrorField(input.error, "status")
  ]
    .filter((part): part is string => part !== null)
    .join(" ");
}

export function formatRuntimeAsyncErrorLog(input: {
  scope: string;
  error: unknown;
}): string {
  return [
    "[runtime]",
    `scope=${safeLogValue(input.scope)}`,
    `message=${safeLogMessage(input.error)}`,
    formatErrorField(input.error, "code"),
    formatErrorField(input.error, "status")
  ]
    .filter((part): part is string => part !== null)
    .join(" ");
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
      "score=<redacted>",
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

  return `[auto-post] date=${result.localDate} windowDays=${result.windowDays} posted=${result.posted.length} skipped=${result.skipped.length}`;
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

  return `[result-sync] range=${result.dateFrom}..${result.dateTo} synced stored=${
    result.storedResults.length
  } skipped=${result.skipped.length}${formatResultSyncSkipCounts(result.skippedDetails)}`;
}

export function formatResultSyncNextLog(input: {
  pendingCount: number;
  nextCheckAtUtc: string | null;
  dueNow: boolean;
}): string | null {
  if (input.pendingCount === 0) {
    return null;
  }

  if (input.dueNow) {
    return `[result-sync] next pending=${input.pendingCount} next=due`;
  }

  return `[result-sync] next pending=${input.pendingCount} next=${input.nextCheckAtUtc ?? "none"}`;
}

export function formatResultSyncStartLog(input: {
  mode: "scheduled" | "forced";
  dateFrom: string;
  dateTo: string;
  pendingMatchIds: readonly string[];
}): string {
  return `[result-sync] start mode=${input.mode} range=${input.dateFrom}..${input.dateTo} pending=${input.pendingMatchIds.length}`;
}

export function formatResultSyncErrorLog(input: {
  mode: "scheduled" | "forced";
  dateFrom: string;
  dateTo: string;
  error: unknown;
}): string {
  return `[result-sync] error mode=${input.mode} range=${input.dateFrom}..${input.dateTo} message=${safeLogMessage(input.error)}`;
}

export function formatStandingsDashboardLog(result: UpdateStandingsDashboardResult): string {
  const counts = countDashboardActions(result.posts.map((post) => post.action));
  const imageCount = result.posts.filter((post) => post.renderState === "image").length;
  const fallbackCount = result.posts.length - imageCount;
  const errorCount = result.posts.filter((post) => post.renderError).length;

  return [
    "[dashboard] standings",
    `posts=${result.posts.length}`,
    `posted=${counts.posted}`,
    `edited=${counts.edited}`,
    `replaced=${counts.replaced}`,
    `image=${imageCount}`,
    `fallback=${fallbackCount}`,
    errorCount > 0 ? `errors=${errorCount}` : null
  ]
    .filter((part): part is string => part !== null)
    .join(" ");
}

export function formatLeaderboardDashboardLog(result: UpdateLeaderboardDashboardResult): string {
  return [
    "[dashboard] leaderboard",
    `action=${result.post.action}`,
    `message=${result.post.messageId}`,
    `render=${result.renderState}`,
    result.renderError ? `error=${safeLogMessage(result.renderError)}` : null
  ]
    .filter((part): part is string => part !== null)
    .join(" ");
}

export function formatBracketDashboardLog(result: UpdateBracketDashboardResult): string {
  return [
    "[dashboard] bracket",
    `action=${result.post.action}`,
    `message=${result.post.messageId}`,
    `phase=${result.bracketPhase}`,
    `render=${result.renderState}`,
    result.renderError ? `error=${safeLogMessage(result.renderError)}` : null
  ]
    .filter((part): part is string => part !== null)
    .join(" ");
}

export function formatThirdPlaceDashboardLog(result: UpdateThirdPlaceDashboardResult): string {
  return [
    "[dashboard] thirdPlaces",
    `action=${result.post.action}`,
    `message=${result.post.messageId}`,
    `status=${result.qualificationStatus}`,
    `render=${result.renderState}`,
    result.renderError ? `error=${safeLogMessage(result.renderError)}` : null
  ]
    .filter((part): part is string => part !== null)
    .join(" ");
}

export function formatChaosDashboardLog(result: UpdateChaosDashboardResult): string {
  const postCounts = {
    posted: 0,
    edited: 0,
    replaced: 0
  };
  const skippedCounts = {
    incomplete: 0,
    alreadyPosted: 0
  };

  for (const post of result.posted) {
    postCounts[post.action] += 1;
  }

  const copyApplied = result.posted.filter((post) => post.copyState === "applied").length;
  const copyFallback = result.posted.filter((post) => post.copyState === "fallback").length;
  const copyDisabled = result.posted.filter((post) => post.copyState === undefined).length;

  for (const skipped of result.skipped) {
    if (skipped.reason === "already-posted") {
      skippedCounts.alreadyPosted += 1;
    } else {
      skippedCounts.incomplete += 1;
    }
  }

  return [
    "[dashboard] recap",
    `posts=${result.posted.length}`,
    `posted=${postCounts.posted}`,
    `edited=${postCounts.edited}`,
    `replaced=${postCounts.replaced}`,
    `skipped=${result.skipped.length}`,
    `incomplete=${skippedCounts.incomplete}`,
    `alreadyPosted=${skippedCounts.alreadyPosted}`,
    result.posted.length > 0
      ? `periods=${result.posted.map((post) => safeLogValue(post.periodKey)).join(",")}`
      : null,
    result.posted.length > 0
      ? `copyApplied=${copyApplied} copyFallback=${copyFallback} copyDisabled=${copyDisabled}`
      : null,
    result.posted.some((post) => post.renderError)
      ? `errors=${result.posted
          .filter((post) => post.renderError)
          .map((post) => `${safeLogValue(post.periodKey)}:${safeLogMessage(post.renderError ?? "")}`)
          .join(",")}`
      : null,
    result.posted.some((post) => post.copyError)
      ? `copyErrors=${result.posted
          .filter((post) => post.copyError)
          .map((post) => `${safeLogValue(post.periodKey)}:${safeLogMessage(post.copyError ?? "")}`)
          .join(",")}`
      : null
  ]
    .filter((part): part is string => part !== null)
    .join(" ");
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

  return entries.map(([key, value]) => `${safeLogValue(key)}:${safeLogOptionValue(key, value)}`).join(",");
}

function formatNullable(value: string | null): string {
  return value === null ? "null" : safeLogValue(value);
}

function safeLogOptionValue(key: string, value: string): string {
  return key.toLowerCase().includes("score") ? "<redacted>" : safeLogValue(value);
}

function safeLogValue(value: string): string {
  const normalized = value.trim().replace(/\s+/gu, "_");

  if (normalized === "") {
    return "empty";
  }

  return normalized.length > 80 ? `${normalized.slice(0, 77)}...` : normalized;
}

function safeLogMessage(error: unknown): string {
  const value =
    error instanceof Error && error.message.trim() !== "" ? error.message : String(error);
  const normalized = redactSensitiveLogText(value).trim().replace(/\s+/gu, " ");

  if (normalized === "") {
    return "unknown";
  }

  return normalized.length > 240 ? `${normalized.slice(0, 237)}...` : normalized;
}

function redactSensitiveLogText(value: string): string {
  return value
    .replace(
      /https:\/\/discord\.com\/api\/v\d+\/interactions\/[^/\s]+\/[^/\s]+\/callback(?:\?[^\s]*)?/gu,
      "https://discord.com/api/v*/interactions/[redacted]/[redacted]/callback"
    )
    .replace(/\bBot\s+[A-Za-z0-9._-]+/gu, "Bot [redacted]");
}

function formatErrorField(error: unknown, field: "code" | "status"): string | null {
  if (typeof error !== "object" || error === null || !(field in error)) {
    return null;
  }

  const value = (error as Partial<Record<typeof field, unknown>>)[field];

  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }

  return `${field}=${safeLogValue(String(value))}`;
}

function formatResultSyncSkipCounts(details: ResultSyncSkippedMatch[] | undefined): string {
  if (!Array.isArray(details) || details.length === 0) {
    return "";
  }

  const manual = details.filter((detail) => detail.reason === "manual-result").length;
  const notFinal = details.filter((detail) => detail.reason === "not-final").length;
  const missingScore = details.filter(
    (detail) => detail.reason === "missing-final-score"
  ).length;

  return ` manual=${manual} notFinal=${notFinal} missingScore=${missingScore}`;
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
