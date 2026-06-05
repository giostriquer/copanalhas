import { describe, expect, test } from "vitest";

import { getLocalDateTimeParts, shouldRunDailyJob } from "./scheduler.js";

describe("daily scheduler", () => {
  test("extracts local date and time parts for a timezone", () => {
    expect(getLocalDateTimeParts(new Date("2026-06-11T12:34:00.000Z"), "UTC")).toEqual({
      localDate: "2026-06-11",
      localTime: "12:34"
    });
  });

  test("runs an enabled daily job once the target local time arrives", () => {
    expect(
      shouldRunDailyJob({
        enabled: true,
        localDate: "2026-06-11",
        localTime: "09:00",
        targetTime: "09:00",
        lastRunDate: null
      })
    ).toEqual({ shouldRun: true, runDate: "2026-06-11" });
  });

  test("does not run before the target local time", () => {
    expect(
      shouldRunDailyJob({
        enabled: true,
        localDate: "2026-06-11",
        localTime: "08:59",
        targetTime: "09:00",
        lastRunDate: null
      })
    ).toEqual({ shouldRun: false });
  });

  test("does not run twice on the same local date", () => {
    expect(
      shouldRunDailyJob({
        enabled: true,
        localDate: "2026-06-11",
        localTime: "10:00",
        targetTime: "09:00",
        lastRunDate: "2026-06-11"
      })
    ).toEqual({ shouldRun: false });
  });
});
