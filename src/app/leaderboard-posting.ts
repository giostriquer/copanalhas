import type { Buffer } from "node:buffer";

import {
  createLeaderboardDashboardMessage,
  formatLeaderboardDashboardTimestamp,
  type LeaderboardDashboardMessage
} from "../leaderboard/format.js";
import { renderLeaderboardDashboardSvg } from "../leaderboard/svg.js";
import { buildLeaderboard, scoreMatch, type MatchResult, type ScorePrediction } from "../scoring/scoring.js";
import type { StoredLeaderboardPost } from "../storage/database.js";

export interface UpdateLeaderboardDashboardOptions {
  guildId: string;
  channelId: string;
  predictions: readonly ScorePrediction[];
  results: readonly MatchResult[];
  timeZone: string;
  now(): Date;
  listLeaderboardPosts(): StoredLeaderboardPost[];
  recordLeaderboardPost(post: StoredLeaderboardPost): void;
  resolveUserDisplayNames?(userIds: readonly string[]): Promise<ReadonlyMap<string, string>>;
  renderPng(svg: string): Promise<Buffer>;
  upsertLeaderboardMessage(
    message: LeaderboardDashboardMessage,
    existingMessageId: string | null
  ): Promise<string>;
}

export interface UpdateLeaderboardDashboardResult {
  action: "updated";
  post: UpdatedLeaderboardPost;
  renderState: "image" | "text-fallback";
  renderError?: string;
}

export interface UpdatedLeaderboardPost {
  messageId: string;
  action: "posted" | "edited" | "replaced";
}

export async function updateLeaderboardDashboard(
  options: UpdateLeaderboardDashboardOptions
): Promise<UpdateLeaderboardDashboardResult> {
  const timestamp = options.now().toISOString();
  const existing = matchingPost(options);
  const scoredPredictions = options.results.flatMap((result) =>
    scoreMatch(result, [...options.predictions])
  );
  const rows = buildLeaderboard(scoredPredictions, options.predictions);
  const displayNames = await resolveLeaderboardDisplayNames(options, rows.map((row) => row.userId));
  const updatedAt = new Date(timestamp);
  let message: LeaderboardDashboardMessage;
  let renderState: UpdateLeaderboardDashboardResult["renderState"] = "image";
  let renderError: string | undefined;

  try {
    const svg = renderLeaderboardDashboardSvg({
      rows,
      displayNames,
      generatedAtLabel: formatLeaderboardDashboardTimestamp(updatedAt, options.timeZone)
    });
    const png = await options.renderPng(svg);
    message = createLeaderboardDashboardMessage(
      {
        rows,
        displayNames,
        updatedAt,
        timeZone: options.timeZone
      },
      png
    );
  } catch (error) {
    renderState = "text-fallback";
    renderError = errorMessage(error);
    message = createLeaderboardDashboardMessage(
      {
        rows,
        displayNames,
        updatedAt,
        timeZone: options.timeZone,
        renderError
      },
      null
    );
  }

  const messageId = await options.upsertLeaderboardMessage(message, existing?.messageId ?? null);
  const postAction = actionForPost(existing?.messageId ?? null, messageId);

  options.recordLeaderboardPost({
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
    renderState,
    ...(renderError ? { renderError } : {})
  };
}

async function resolveLeaderboardDisplayNames(
  options: Pick<UpdateLeaderboardDashboardOptions, "resolveUserDisplayNames">,
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
  options: Pick<
    UpdateLeaderboardDashboardOptions,
    "guildId" | "channelId" | "listLeaderboardPosts"
  >
): StoredLeaderboardPost | undefined {
  return options
    .listLeaderboardPosts()
    .find((post) => post.guildId === options.guildId && post.channelId === options.channelId);
}

function actionForPost(
  existingMessageId: string | null,
  updatedMessageId: string
): UpdatedLeaderboardPost["action"] {
  if (!existingMessageId) {
    return "posted";
  }

  return existingMessageId === updatedMessageId ? "edited" : "replaced";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
