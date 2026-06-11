import type { PostDueMatchCardsResult } from "./match-card-posting.js";
import { shouldRunDailyJob } from "./scheduler.js";
import { getMatchdayDateTimeParts } from "../worldcup/matchday.js";

export interface AutoPostTickOptions {
  enabled: boolean;
  targetTime: string;
  timeZone: string;
  matchdayRolloverTime: string;
  windowDays: number;
  lastRunDate: string | null;
  now(): Date;
  postDueMatchCards(date: string): Promise<PostDueMatchCardsResult>;
}

export interface AutoPostWindowDateResult {
  date: string;
  posted: string[];
  skipped: string[];
}

export type AutoPostTickResult =
  | { action: "disabled" }
  | { action: "not-due"; localDate: string; localTime: string }
  | {
      action: "posted";
      localDate: string;
      windowDays: number;
      dates: AutoPostWindowDateResult[];
      posted: string[];
      skipped: string[];
    };

export async function runAutoPostTick(
  options: AutoPostTickOptions
): Promise<AutoPostTickResult> {
  if (!options.enabled) {
    return { action: "disabled" };
  }

  const localDateTime = getMatchdayDateTimeParts(
    options.now(),
    options.timeZone,
    options.matchdayRolloverTime
  );
  const decision = shouldRunDailyJob({
    enabled: options.enabled,
    localDate: localDateTime.matchdayDate,
    localTime: localDateTime.dailyJobTime,
    targetTime: options.targetTime,
    lastRunDate: options.lastRunDate
  });

  if (!decision.shouldRun) {
    return {
      action: "not-due",
      localDate: localDateTime.matchdayDate,
      localTime: localDateTime.localTime
    };
  }

  const dates: AutoPostWindowDateResult[] = [];

  for (const date of windowDates(decision.runDate, options.windowDays)) {
    const result = await options.postDueMatchCards(date);
    dates.push({
      date,
      posted: result.posted,
      skipped: result.skipped
    });
  }

  return {
    action: "posted",
    localDate: decision.runDate,
    windowDays: options.windowDays,
    dates,
    posted: dates.flatMap((result) => result.posted),
    skipped: dates.flatMap((result) => result.skipped)
  };
}

function windowDates(startDate: string, windowDays: number): string[] {
  return Array.from({ length: windowDays }, (_, index) => shiftDate(startDate, index));
}

function shiftDate(localDate: string, days: number): string {
  const date = new Date(`${localDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}
