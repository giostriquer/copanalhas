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
  timeZone: string
): FormattedPredictionWindow {
  const window = getPredictionWindow(match);

  return {
    kickoffText: window.kickoffAtUtc
      ? `Kickoff: ${formatInstant(window.kickoffAtUtc, timeZone)}`
      : "Kickoff: not verified",
    closesText: window.closesAtUtc
      ? `Predictions close: ${formatInstant(window.closesAtUtc, timeZone)}`
      : "Predictions close: not available"
  };
}

function normalizeIsoTimestamp(value: string): string {
  return new Date(value).toISOString();
}

function formatInstant(value: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZoneName: "short"
  }).formatToParts(new Date(value));

  return `${part(parts, "year")}-${part(parts, "month")}-${part(parts, "day")} ${part(
    parts,
    "hour"
  )}:${part(parts, "minute")} ${part(parts, "timeZoneName")}`;
}

function part(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((entry) => entry.type === type)?.value ?? "";
}
