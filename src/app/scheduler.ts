export interface LocalDateTimeParts {
  localDate: string;
  localTime: string;
}

export interface DailyJobInput extends LocalDateTimeParts {
  enabled: boolean;
  targetTime: string;
  lastRunDate: string | null;
}

export type DailyJobDecision =
  | { shouldRun: true; runDate: string }
  | { shouldRun: false };

export function getLocalDateTimeParts(now: Date, timeZone: string): LocalDateTimeParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(now);

  return {
    localDate: `${part(parts, "year")}-${part(parts, "month")}-${part(parts, "day")}`,
    localTime: `${part(parts, "hour")}:${part(parts, "minute")}`
  };
}

export function shouldRunDailyJob(input: DailyJobInput): DailyJobDecision {
  if (!input.enabled) {
    return { shouldRun: false };
  }

  if (input.lastRunDate === input.localDate) {
    return { shouldRun: false };
  }

  if (input.localTime < input.targetTime) {
    return { shouldRun: false };
  }

  return { shouldRun: true, runDate: input.localDate };
}

function part(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((entry) => entry.type === type)?.value ?? "";
}
