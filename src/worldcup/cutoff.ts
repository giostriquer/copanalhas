import type { WorldCupMatch } from "./types.js";

const predictionCutoffMinutes = 30;

export interface PredictionWindow {
  kickoffAtUtc: string | null;
  closesAtUtc: string | null;
}

export type PredictionSubmissionWindow =
  | { ok: true; closesAtUtc: string }
  | { ok: false; reason: "missing-kickoff" }
  | { ok: false; reason: "closed"; closesAtUtc: string };

export interface FormattedPredictionWindow {
  kickoffText: string;
  closesText: string;
}

export type DiscordTimestampStyle = "F" | "R";

export function getPredictionWindow(match: WorldCupMatch): PredictionWindow {
  if (!match.kickoffAtUtc) {
    return {
      kickoffAtUtc: null,
      closesAtUtc: null
    };
  }

  return {
    kickoffAtUtc: normalizeIsoTimestamp(match.kickoffAtUtc),
    closesAtUtc: new Date(
      Date.parse(match.kickoffAtUtc) - predictionCutoffMinutes * 60 * 1000
    ).toISOString()
  };
}

export function canSubmitPredictionAt(
  match: WorldCupMatch,
  now: Date
): PredictionSubmissionWindow {
  const window = getPredictionWindow(match);

  if (!window.closesAtUtc) {
    return { ok: false, reason: "missing-kickoff" };
  }

  if (now.getTime() >= Date.parse(window.closesAtUtc)) {
    return {
      ok: false,
      reason: "closed",
      closesAtUtc: window.closesAtUtc
    };
  }

  return {
    ok: true,
    closesAtUtc: window.closesAtUtc
  };
}

export function formatPredictionWindow(
  match: WorldCupMatch,
  _timeZone: string
): FormattedPredictionWindow {
  const window = getPredictionWindow(match);

  return {
    kickoffText: window.kickoffAtUtc
      ? `Kickoff: ${formatDiscordInstant(window.kickoffAtUtc)}`
      : "Kickoff: not verified",
    closesText: window.closesAtUtc
      ? `Predictions close: ${formatDiscordInstant(window.closesAtUtc)}`
      : "Predictions close: not available"
  };
}

function normalizeIsoTimestamp(value: string): string {
  return new Date(value).toISOString();
}

export function formatDiscordInstant(value: string): string {
  return `${formatDiscordTimestamp(value, "F")} (${formatDiscordTimestamp(value, "R")})`;
}

export function formatDiscordTimestamp(value: string, style: DiscordTimestampStyle): string {
  const unixSeconds = Math.floor(Date.parse(value) / 1000);

  return `<t:${unixSeconds}:${style}>`;
}
