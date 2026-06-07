import type { WorldCupMatch } from "./types.js";

export const defaultMatchdayRolloverTime = "06:00";

export interface MatchdayDateTimeParts {
  matchdayDate: string;
  localDate: string;
  localTime: string;
  dailyJobTime: string;
}

export function getMatchdayDateForMatch(
  match: WorldCupMatch,
  timeZone: string,
  rolloverTime: string = defaultMatchdayRolloverTime
): string {
  if (!match.kickoffAtUtc) {
    return match.localDate;
  }

  return getMatchdayDateForInstant(new Date(match.kickoffAtUtc), timeZone, rolloverTime);
}

export function isMatchOnMatchday(
  match: WorldCupMatch,
  matchdayDate: string,
  timeZone: string,
  rolloverTime: string = defaultMatchdayRolloverTime
): boolean {
  return getMatchdayDateForMatch(match, timeZone, rolloverTime) === matchdayDate;
}

export function getMatchdayDateForInstant(
  instant: Date,
  timeZone: string,
  rolloverTime: string = defaultMatchdayRolloverTime
): string {
  return getMatchdayDateTimeParts(instant, timeZone, rolloverTime).matchdayDate;
}

export function getMatchdayDateTimeParts(
  instant: Date,
  timeZone: string,
  rolloverTime: string = defaultMatchdayRolloverTime
): MatchdayDateTimeParts {
  const local = getLocalDateTimeParts(instant, timeZone);
  const localMinutes = minutesFromTime(local.localTime);
  const rolloverMinutes = minutesFromTime(rolloverTime);
  const beforeRollover = localMinutes < rolloverMinutes;

  return {
    matchdayDate: beforeRollover ? shiftDate(local.localDate, -1) : local.localDate,
    localDate: local.localDate,
    localTime: local.localTime,
    dailyJobTime: beforeRollover ? formatMinutes(localMinutes + 24 * 60) : local.localTime
  };
}

function getLocalDateTimeParts(instant: Date, timeZone: string): {
  localDate: string;
  localTime: string;
} {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(instant);

  return {
    localDate: `${part(parts, "year")}-${part(parts, "month")}-${part(parts, "day")}`,
    localTime: `${part(parts, "hour")}:${part(parts, "minute")}`
  };
}

function part(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((entry) => entry.type === type)?.value ?? "";
}

function minutesFromTime(value: string): number {
  const [hours = "0", minutes = "0"] = value.split(":");

  return Number.parseInt(hours, 10) * 60 + Number.parseInt(minutes, 10);
}

function formatMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}

function shiftDate(localDate: string, days: number): string {
  const date = new Date(`${localDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}
