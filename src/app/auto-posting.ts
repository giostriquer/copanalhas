import type { PostDueMatchCardsResult } from "./match-card-posting.js";
import { shouldRunDailyJob } from "./scheduler.js";
import { getMatchdayDateTimeParts } from "../worldcup/matchday.js";

export interface AutoPostTickOptions {
  enabled: boolean;
  targetTime: string;
  timeZone: string;
  matchdayRolloverTime: string;
  lastRunDate: string | null;
  now(): Date;
  postDueMatchCards(date: string): Promise<PostDueMatchCardsResult>;
}

export type AutoPostTickResult =
  | { action: "disabled" }
  | { action: "not-due"; localDate: string; localTime: string }
  | { action: "posted"; localDate: string; posted: string[]; skipped: string[] };

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

  const result = await options.postDueMatchCards(decision.runDate);

  return {
    action: "posted",
    localDate: decision.runDate,
    posted: result.posted,
    skipped: result.skipped
  };
}
