import type { Buffer } from "node:buffer";

import {
  createStandingsDashboardMessages,
  dashboardGroups,
  type StandingsDashboardMessage,
  type StandingsPostKey
} from "../standings/format.js";
import { renderStandingsDashboardSvg } from "../standings/svg.js";
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
  renderPng?(svg: string): Promise<Buffer>;
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
  renderState: "image" | "text-fallback";
  renderError?: string;
}

export async function updateStandingsDashboard(
  options: UpdateStandingsDashboardOptions
): Promise<UpdateStandingsDashboardResult> {
  const timestamp = options.now().toISOString();
  const existingPosts = matchingPosts(options);
  const standings = computeGroupStandings(options.matches, options.results);
  const pngByKey = new Map<StandingsPostKey, Buffer>();
  const renderErrors = new Map<StandingsPostKey, string>();
  const renderStates = new Map<StandingsPostKey, UpdatedStandingsPost["renderState"]>();

  for (const dashboard of dashboardGroups) {
    if (!options.renderPng) {
      renderStates.set(dashboard.key, "text-fallback");
      continue;
    }

    try {
      const svg = renderStandingsDashboardSvg({
        standings,
        groups: dashboard.groups,
        label: dashboard.label,
        generatedAtLabel: formatDashboardTimestamp(new Date(timestamp), options.timeZone)
      });
      const png = await options.renderPng(svg);

      pngByKey.set(dashboard.key, png);
      renderStates.set(dashboard.key, "image");
    } catch (error) {
      renderErrors.set(dashboard.key, errorMessage(error));
      renderStates.set(dashboard.key, "text-fallback");
    }
  }
  const messages = createStandingsDashboardMessages({
    standings,
    updatedAt: new Date(timestamp),
    timeZone: options.timeZone,
    pngByKey,
    renderErrors
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
      action,
      renderState: renderStates.get(message.key) ?? "text-fallback",
      ...(renderErrors.has(message.key) ? { renderError: renderErrors.get(message.key)! } : {})
    });
  }

  return {
    action: "updated",
    posts
  };
}

function formatDashboardTimestamp(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZoneName: "short"
  }).formatToParts(date);

  return `${part(parts, "year")}-${part(parts, "month")}-${part(parts, "day")} ${part(
    parts,
    "hour"
  )}:${part(parts, "minute")} ${part(parts, "timeZoneName")}`;
}

function part(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((candidate) => candidate.type === type)?.value ?? "";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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
