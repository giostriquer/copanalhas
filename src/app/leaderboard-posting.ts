import {
  createLeaderboardDashboardMessage,
  type LeaderboardDashboardMessage
} from "../leaderboard/format.js";
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
  upsertLeaderboardMessage(
    message: LeaderboardDashboardMessage,
    existingMessageId: string | null
  ): Promise<string>;
}

export interface UpdateLeaderboardDashboardResult {
  action: "updated";
  post: UpdatedLeaderboardPost;
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
  const message = createLeaderboardDashboardMessage({
    rows: buildLeaderboard(scoredPredictions),
    updatedAt: new Date(timestamp),
    timeZone: options.timeZone
  });
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
    }
  };
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
