import {
  createStandingsDashboardMessages,
  type StandingsDashboardMessage,
  type StandingsPostKey
} from "../standings/format.js";
import { computeGroupStandings, type StandingsResult } from "../standings/standings.js";
import type { StoredStandingsPost } from "../storage/database.js";
import type { WorldCupMatch } from "../worldcup/types.js";

export interface UpdateStandingsDashboardOptions {
  guildId: string;
  channelId: string;
  matches: readonly WorldCupMatch[];
  results: readonly StandingsResult[];
  timeZone: string;
  now(): Date;
  listStandingsPosts(): StoredStandingsPost[];
  recordStandingsPost(post: StoredStandingsPost): void;
  upsertStandingsMessage(
    message: StandingsDashboardMessage,
    existingMessageId: string | null
  ): Promise<string>;
}

export interface UpdateStandingsDashboardResult {
  action: "updated";
  posts: UpdatedStandingsPost[];
}

export interface UpdatedStandingsPost {
  postKey: StandingsPostKey;
  messageId: string;
  action: "posted" | "edited" | "replaced";
}

export async function updateStandingsDashboard(
  options: UpdateStandingsDashboardOptions
): Promise<UpdateStandingsDashboardResult> {
  const timestamp = options.now().toISOString();
  const existingPosts = matchingPosts(options);
  const standings = computeGroupStandings(options.matches, options.results);
  const messages = createStandingsDashboardMessages({
    standings,
    updatedAt: new Date(timestamp),
    timeZone: options.timeZone
  });
  const posts: UpdatedStandingsPost[] = [];

  for (const message of messages) {
    const existing = existingPosts.get(message.key);
    const messageId = await options.upsertStandingsMessage(message, existing?.messageId ?? null);
    const action = actionForPost(existing?.messageId ?? null, messageId);

    options.recordStandingsPost({
      postKey: message.key,
      guildId: options.guildId,
      channelId: options.channelId,
      messageId,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp
    });
    posts.push({
      postKey: message.key,
      messageId,
      action
    });
  }

  return {
    action: "updated",
    posts
  };
}

function matchingPosts(
  options: Pick<
    UpdateStandingsDashboardOptions,
    "guildId" | "channelId" | "listStandingsPosts"
  >
): Map<StandingsPostKey, StoredStandingsPost> {
  return new Map(
    options
      .listStandingsPosts()
      .filter((post) => post.guildId === options.guildId && post.channelId === options.channelId)
      .map((post) => [post.postKey, post])
  );
}

function actionForPost(
  existingMessageId: string | null,
  updatedMessageId: string
): UpdatedStandingsPost["action"] {
  if (!existingMessageId) {
    return "posted";
  }

  return existingMessageId === updatedMessageId ? "edited" : "replaced";
}
