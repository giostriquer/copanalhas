import type { PostDueMatchCardsResult } from "./match-card-posting.js";
import { getLocalDateTimeParts, shouldRunDailyJob } from "./scheduler.js";

export interface AutoPostTickOptions {
  enabled: boolean;
  targetTime: string;
  timeZone: string;
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

  const localDateTime = getLocalDateTimeParts(options.now(), options.timeZone);
  const decision = shouldRunDailyJob({
    enabled: options.enabled,
    localDate: localDateTime.localDate,
    localTime: localDateTime.localTime,
    targetTime: options.targetTime,
    lastRunDate: options.lastRunDate
  });

  if (!decision.shouldRun) {
    return {
      action: "not-due",
      localDate: localDateTime.localDate,
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
