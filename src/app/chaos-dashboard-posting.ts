import type { Buffer } from "node:buffer";

import {
  createChaosDashboardMessage,
  type ChaosDashboardMessage
} from "../chaos-dashboard/format.js";
import { renderChaosDashboardSvg } from "../chaos-dashboard/svg.js";
import {
  buildChaosDashboardModel,
  createWeeklySnapshotRows
} from "../chaos-dashboard/stats.js";
import {
  filterPredictionsForChaosRecapPeriod,
  filterResultsForChaosRecapPeriod,
  listChaosRecapPeriods,
  matchesForChaosRecapPeriod,
  type ChaosRecapPeriod
} from "../chaos-dashboard/periods.js";
import type { ChaosWeeklySnapshotRow } from "../chaos-dashboard/types.js";
import { buildLeaderboard, scoreMatch, type MatchResult, type ScorePrediction } from "../scoring/scoring.js";
import type {
  StoredChaosDashboardPost,
  StoredChaosWeeklySnapshotRow
} from "../storage/database.js";
import type { WorldCupMatch } from "../worldcup/types.js";

export interface UpdateChaosDashboardOptions {
  guildId: string;
  channelId: string;
  matches: readonly WorldCupMatch[];
  predictions: readonly ScorePrediction[];
  results: readonly MatchResult[];
  timeZone: string;
  now(): Date;
  refreshExisting?: boolean;
  listChaosDashboardPosts(): StoredChaosDashboardPost[];
  recordChaosDashboardPost(post: StoredChaosDashboardPost): void;
  listChaosWeeklySnapshotRows(
    weekStart: string,
    guildId: string,
    channelId: string
  ): StoredChaosWeeklySnapshotRow[];
  recordChaosWeeklySnapshotRows(
    weekStart: string,
    guildId: string,
    channelId: string,
    rows: readonly ChaosWeeklySnapshotRow[],
    createdAt: string
  ): void;
  resolveUserDisplayNames?(userIds: readonly string[]): Promise<ReadonlyMap<string, string>>;
  resolveUserAvatarDataUris?(userIds: readonly string[]): Promise<ReadonlyMap<string, string>>;
  renderPng(svg: string): Promise<Buffer>;
  upsertChaosDashboardMessage(
    message: ChaosDashboardMessage,
    existingMessageId: string | null
  ): Promise<string>;
}

export interface UpdateChaosDashboardResult {
  action: "updated";
  posted: UpdatedChaosDashboardPost[];
  skipped: SkippedChaosRecapPeriod[];
}

export interface UpdatedChaosDashboardPost {
  periodKey: string;
  messageId: string;
  action: "posted" | "edited" | "replaced";
  renderState: "image" | "text-fallback";
  renderError?: string;
}

export interface SkippedChaosRecapPeriod {
  periodKey: string;
  reason: "incomplete" | "already-posted";
}

export async function updateChaosRecaps(
  options: UpdateChaosDashboardOptions
): Promise<UpdateChaosDashboardResult> {
  const timestamp = options.now().toISOString();
  const updatedAt = new Date(timestamp);
  const periods = listChaosRecapPeriods(options.matches);
  const posted: UpdatedChaosDashboardPost[] = [];
  const skipped: SkippedChaosRecapPeriod[] = [];

  for (const period of periods) {
    const periodMatches = matchesForChaosRecapPeriod(period, options.matches);
    const periodResults = filterResultsForChaosRecapPeriod(
      period,
      options.matches,
      options.results
    );

    if (periodResults.length < periodMatches.length) {
      skipped.push({ periodKey: period.key, reason: "incomplete" });
      continue;
    }

    const existing = matchingPost(options, period.key);

    if (existing && options.refreshExisting === false) {
      skipped.push({ periodKey: period.key, reason: "already-posted" });
      continue;
    }

    const periodPredictions = filterPredictionsForChaosRecapPeriod(
      period,
      options.matches,
      options.predictions
    );
    const post = await updateChaosRecapPeriod({
      options,
      period,
      periodMatches,
      periodPredictions,
      periodResults,
      existing,
      timestamp,
      updatedAt
    });

    posted.push(post);
  }

  return {
    action: "updated",
    posted,
    skipped
  };
}

export const updateChaosDashboard = updateChaosRecaps;

async function updateChaosRecapPeriod(input: {
  options: UpdateChaosDashboardOptions;
  period: ChaosRecapPeriod;
  periodMatches: readonly WorldCupMatch[];
  periodPredictions: readonly ScorePrediction[];
  periodResults: readonly MatchResult[];
  existing: StoredChaosDashboardPost | undefined;
  timestamp: string;
  updatedAt: Date;
}): Promise<UpdatedChaosDashboardPost> {
  const scoredPredictions = input.periodResults.flatMap((result) =>
    scoreMatch(result, [...input.periodPredictions])
  );
  const leaderboardRows = buildLeaderboard(scoredPredictions, input.periodPredictions);
  const userIds = leaderboardRows.map((row) => row.userId);
  const displayNames = await resolveDisplayNames(input.options, userIds);
  const avatarDataUris = await resolveAvatarDataUris(
    input.options,
    leaderboardRows[0] ? [leaderboardRows[0].userId] : []
  );
  const previousWeekRows = input.options.listChaosWeeklySnapshotRows(
    input.period.key,
    input.options.guildId,
    input.options.channelId
  );

  if (previousWeekRows.length === 0) {
    input.options.recordChaosWeeklySnapshotRows(
      input.period.key,
      input.options.guildId,
      input.options.channelId,
      createWeeklySnapshotRows(leaderboardRows),
      input.timestamp
    );
  }

  const model = buildChaosDashboardModel({
    matches: input.periodMatches,
    predictions: input.periodPredictions,
    results: input.periodResults,
    period: {
      key: input.period.key,
      label: input.period.label
    },
    displayNames,
    avatarDataUris,
    previousWeekRows,
    now: input.updatedAt,
    timeZone: input.options.timeZone
  });
  let message: ChaosDashboardMessage;
  let renderState: UpdatedChaosDashboardPost["renderState"] = "image";
  let renderError: string | undefined;

  try {
    const svg = renderChaosDashboardSvg(model);
    const png = await input.options.renderPng(svg);
    message = createChaosDashboardMessage(model, png);
  } catch (error) {
    renderState = "text-fallback";
    renderError = errorMessage(error);
    message = createChaosDashboardMessage(model, null);
  }

  const messageId = await input.options.upsertChaosDashboardMessage(
    message,
    input.existing?.messageId ?? null
  );
  const postAction = actionForPost(input.existing?.messageId ?? null, messageId);

  input.options.recordChaosDashboardPost({
    periodKey: input.period.key,
    guildId: input.options.guildId,
    channelId: input.options.channelId,
    messageId,
    createdAt: input.existing?.createdAt ?? input.timestamp,
    updatedAt: input.timestamp
  });

  return {
    periodKey: input.period.key,
    messageId,
    action: postAction,
    renderState,
    ...(renderError ? { renderError } : {})
  };
}

async function resolveAvatarDataUris(
  options: Pick<UpdateChaosDashboardOptions, "resolveUserAvatarDataUris">,
  userIds: readonly string[]
): Promise<ReadonlyMap<string, string>> {
  if (!options.resolveUserAvatarDataUris || userIds.length === 0) {
    return new Map();
  }

  try {
    return await options.resolveUserAvatarDataUris(userIds);
  } catch {
    return new Map();
  }
}

async function resolveDisplayNames(
  options: Pick<UpdateChaosDashboardOptions, "resolveUserDisplayNames">,
  userIds: readonly string[]
): Promise<ReadonlyMap<string, string>> {
  if (!options.resolveUserDisplayNames || userIds.length === 0) {
    return new Map();
  }

  try {
    return await options.resolveUserDisplayNames(userIds);
  } catch {
    return new Map();
  }
}

function matchingPost(
  options: Pick<UpdateChaosDashboardOptions, "guildId" | "channelId" | "listChaosDashboardPosts">,
  periodKey: string
): StoredChaosDashboardPost | undefined {
  return options
    .listChaosDashboardPosts()
    .find(
      (post) =>
        post.periodKey === periodKey &&
        post.guildId === options.guildId &&
        post.channelId === options.channelId
    );
}

function actionForPost(
  existingMessageId: string | null,
  updatedMessageId: string
): UpdatedChaosDashboardPost["action"] {
  if (!existingMessageId) {
    return "posted";
  }

  return existingMessageId === updatedMessageId ? "edited" : "replaced";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
