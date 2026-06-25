import type { Buffer } from "node:buffer";

import {
  createBracketDashboardMessage,
  type BracketDashboardMessage
} from "../bracket/format.js";
import { renderBracketSvg } from "../bracket/svg.js";
import { createBracketState } from "../bracket/state.js";
import type { BracketPhase } from "../bracket/types.js";
import type { StandingsResult } from "../standings/standings.js";
import type { StoredBracketPost } from "../storage/database.js";
import type { WorldCupMatch } from "../worldcup/types.js";

export interface UpdateBracketDashboardOptions {
  guildId: string;
  channelId: string;
  matches: readonly WorldCupMatch[];
  results: readonly StandingsResult[];
  timeZone: string;
  now(): Date;
  listBracketPosts(): StoredBracketPost[];
  recordBracketPost(post: StoredBracketPost): void;
  renderPng(svg: string): Promise<Buffer>;
  upsertBracketMessage(
    message: BracketDashboardMessage,
    existingMessageId: string | null
  ): Promise<string>;
}

export interface UpdateBracketDashboardResult {
  action: "updated";
  post: UpdatedBracketPost;
  bracketPhase: BracketPhase;
  renderState: "image" | "text-fallback";
  renderError?: string;
}

export interface UpdatedBracketPost {
  messageId: string;
  action: "posted" | "edited" | "replaced";
}

export async function updateBracketDashboard(
  options: UpdateBracketDashboardOptions
): Promise<UpdateBracketDashboardResult> {
  const timestamp = options.now().toISOString();
  const updatedAt = new Date(timestamp);
  const existing = matchingPost(options);
  const bracketState = {
    ...createBracketState({
      matches: options.matches,
      results: options.results,
      timeZone: options.timeZone
    }),
    generatedAtLabel: formatDashboardTimestamp(updatedAt, options.timeZone)
  };
  let message: BracketDashboardMessage;
  let renderState: UpdateBracketDashboardResult["renderState"] = "image";
  let renderError: string | undefined;

  try {
    const svg = renderBracketSvg(bracketState);
    const png = await options.renderPng(svg);
    message = createBracketDashboardMessage(bracketState, png);
  } catch (error) {
    renderState = "text-fallback";
    renderError = errorMessage(error);
    message = createBracketDashboardMessage(
      {
        ...bracketState,
        notes: [...bracketState.notes, `Dashboard image render failed: ${renderError}`]
      },
      null
    );
  }

  const messageId = await options.upsertBracketMessage(message, existing?.messageId ?? null);
  const postAction = actionForPost(existing?.messageId ?? null, messageId);

  options.recordBracketPost({
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
    bracketPhase: bracketState.phase,
    renderState,
    ...(renderError ? { renderError } : {})
  };
}

function matchingPost(
  options: Pick<UpdateBracketDashboardOptions, "guildId" | "channelId" | "listBracketPosts">
): StoredBracketPost | undefined {
  return options
    .listBracketPosts()
    .find((post) => post.guildId === options.guildId && post.channelId === options.channelId);
}

function actionForPost(
  existingMessageId: string | null,
  updatedMessageId: string
): UpdatedBracketPost["action"] {
  if (!existingMessageId) {
    return "posted";
  }

  return existingMessageId === updatedMessageId ? "edited" : "replaced";
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

function part(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes
): string {
  return parts.find((candidate) => candidate.type === type)?.value ?? "";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
