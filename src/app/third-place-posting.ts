import type { Buffer } from "node:buffer";

import {
  createThirdPlaceDashboardMessage,
  type ThirdPlaceDashboardMessage
} from "../third-place/format.js";
import { renderThirdPlaceDashboardSvg } from "../third-place/svg.js";
import { computeThirdPlaceStandings } from "../third-place/standings.js";
import type { StandingsResult } from "../standings/standings.js";
import type { StoredThirdPlacePost } from "../storage/database.js";
import type { WorldCupMatch } from "../worldcup/types.js";
import type { FifaQualificationStatus } from "../worldcup/fifa-qualification.js";

export interface UpdateThirdPlaceDashboardOptions {
  guildId: string;
  channelId: string;
  matches: readonly WorldCupMatch[];
  results: readonly StandingsResult[];
  timeZone: string;
  now(): Date;
  listThirdPlacePosts(): StoredThirdPlacePost[];
  recordThirdPlacePost(post: StoredThirdPlacePost): void;
  renderPng?(svg: string): Promise<Buffer>;
  upsertThirdPlaceMessage(
    message: ThirdPlaceDashboardMessage,
    existingMessageId: string | null
  ): Promise<string>;
}

export interface UpdateThirdPlaceDashboardResult {
  action: "updated";
  post: UpdatedThirdPlacePost;
  qualificationStatus: FifaQualificationStatus;
  renderState: "image" | "text-fallback";
  renderError?: string;
}

export interface UpdatedThirdPlacePost {
  messageId: string;
  action: "posted" | "edited" | "replaced";
}

export async function updateThirdPlaceDashboard(
  options: UpdateThirdPlaceDashboardOptions
): Promise<UpdateThirdPlaceDashboardResult> {
  const timestamp = options.now().toISOString();
  const updatedAt = new Date(timestamp);
  const existing = matchingPost(options);
  const standings = computeThirdPlaceStandings(options.matches, options.results);
  let png: Buffer | undefined;
  let renderState: UpdateThirdPlaceDashboardResult["renderState"] = "text-fallback";
  let renderError: string | undefined;

  if (options.renderPng) {
    try {
      const svg = renderThirdPlaceDashboardSvg({
        standings,
        generatedAtLabel: formatDashboardTimestamp(updatedAt, options.timeZone)
      });
      png = await options.renderPng(svg);
      renderState = "image";
    } catch (error) {
      renderError = errorMessage(error);
    }
  }

  const message = createThirdPlaceDashboardMessage({
    standings,
    updatedAt,
    timeZone: options.timeZone,
    ...(png ? { png } : {}),
    ...(renderError ? { renderError } : {})
  });
  const messageId = await options.upsertThirdPlaceMessage(message, existing?.messageId ?? null);
  const postAction = actionForPost(existing?.messageId ?? null, messageId);

  options.recordThirdPlacePost({
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
    qualificationStatus: standings.status,
    renderState,
    ...(renderError ? { renderError } : {})
  };
}

function matchingPost(
  options: Pick<UpdateThirdPlaceDashboardOptions, "guildId" | "channelId" | "listThirdPlacePosts">
): StoredThirdPlacePost | undefined {
  return options
    .listThirdPlacePosts()
    .find((post) => post.guildId === options.guildId && post.channelId === options.channelId);
}

function actionForPost(
  existingMessageId: string | null,
  updatedMessageId: string
): UpdatedThirdPlacePost["action"] {
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

function part(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((candidate) => candidate.type === type)?.value ?? "";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
