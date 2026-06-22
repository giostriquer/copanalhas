import type { Buffer } from "node:buffer";

import {
  createChaosDashboardMessage,
  type ChaosDashboardMessage
} from "../chaos-dashboard/format.js";
import { renderChaosDashboardSvg } from "../chaos-dashboard/svg.js";
import {
  buildChaosDashboardModel,
  createWeeklySnapshotRows,
  weekStartKey
} from "../chaos-dashboard/stats.js";
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
  renderPng(svg: string): Promise<Buffer>;
  upsertChaosDashboardMessage(
    message: ChaosDashboardMessage,
    existingMessageId: string | null
  ): Promise<string>;
}

export interface UpdateChaosDashboardResult {
  action: "updated";
  post: UpdatedChaosDashboardPost;
  weekStart: string;
  renderState: "image" | "text-fallback";
  renderError?: string;
}

export interface UpdatedChaosDashboardPost {
  messageId: string;
  action: "posted" | "edited" | "replaced";
}

export async function updateChaosDashboard(
  options: UpdateChaosDashboardOptions
): Promise<UpdateChaosDashboardResult> {
  const timestamp = options.now().toISOString();
  const updatedAt = new Date(timestamp);
  const weekStart = weekStartKey(updatedAt, options.timeZone);
  const existing = matchingPost(options);
  const scoredPredictions = options.results.flatMap((result) =>
    scoreMatch(result, [...options.predictions])
  );
  const leaderboardRows = buildLeaderboard(scoredPredictions, options.predictions);
  const userIds = leaderboardRows.map((row) => row.userId);
  const displayNames = await resolveDisplayNames(options, userIds);
  const previousWeekRows = options.listChaosWeeklySnapshotRows(
    weekStart,
    options.guildId,
    options.channelId
  );

  if (previousWeekRows.length === 0) {
    options.recordChaosWeeklySnapshotRows(
      weekStart,
      options.guildId,
      options.channelId,
      createWeeklySnapshotRows(leaderboardRows),
      timestamp
    );
  }

  const model = buildChaosDashboardModel({
    matches: options.matches,
    predictions: options.predictions,
    results: options.results,
    displayNames,
    previousWeekRows,
    now: updatedAt,
    timeZone: options.timeZone
  });
  let message: ChaosDashboardMessage;
  let renderState: UpdateChaosDashboardResult["renderState"] = "image";
  let renderError: string | undefined;

  try {
    const svg = renderChaosDashboardSvg(model);
    const png = await options.renderPng(svg);
    message = createChaosDashboardMessage(model, png);
  } catch (error) {
    renderState = "text-fallback";
    renderError = errorMessage(error);
    message = createChaosDashboardMessage(model, null);
  }

  const messageId = await options.upsertChaosDashboardMessage(
    message,
    existing?.messageId ?? null
  );
  const postAction = actionForPost(existing?.messageId ?? null, messageId);

  options.recordChaosDashboardPost({
    guildId: options.guildId,
    channelId: options.channelId,
    messageId,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp
  });

  return {
    action: "updated",
    post: {
      messageId,
      action: postAction
    },
    weekStart,
    renderState,
    ...(renderError ? { renderError } : {})
  };
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
  options: Pick<UpdateChaosDashboardOptions, "guildId" | "channelId" | "listChaosDashboardPosts">
): StoredChaosDashboardPost | undefined {
  return options
    .listChaosDashboardPosts()
    .find((post) => post.guildId === options.guildId && post.channelId === options.channelId);
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
