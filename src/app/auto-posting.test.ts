import { describe, expect, test, vi } from "vitest";

import { runAutoPostTick } from "./auto-posting.js";

describe("runAutoPostTick", () => {
  test("returns disabled without posting when auto-posting is off", async () => {
    const postDueMatchCards = vi.fn();

    await expect(
      runAutoPostTick({
        enabled: false,
        targetTime: "09:00",
        timeZone: "UTC",
        matchdayRolloverTime: "06:00",
        windowDays: 1,
        lastRunDate: null,
        now: () => new Date("2026-06-11T09:00:00.000Z"),
        postDueMatchCards
      })
    ).resolves.toEqual({ action: "disabled" });
    expect(postDueMatchCards).not.toHaveBeenCalled();
  });

  test("does not post before the configured local time", async () => {
    const postDueMatchCards = vi.fn();

    await expect(
      runAutoPostTick({
        enabled: true,
        targetTime: "09:00",
        timeZone: "UTC",
        matchdayRolloverTime: "06:00",
        windowDays: 1,
        lastRunDate: null,
        now: () => new Date("2026-06-11T08:59:00.000Z"),
        postDueMatchCards
      })
    ).resolves.toEqual({
      action: "not-due",
      localDate: "2026-06-11",
      localTime: "08:59"
    });
    expect(postDueMatchCards).not.toHaveBeenCalled();
  });

  test("posts due match cards once per local date", async () => {
    const postDueMatchCards = vi.fn(async () => ({
      posted: ["wc2026-001"],
      skipped: ["wc2026-002"]
    }));

    await expect(
      runAutoPostTick({
        enabled: true,
        targetTime: "09:00",
        timeZone: "UTC",
        matchdayRolloverTime: "06:00",
        windowDays: 1,
        lastRunDate: null,
        now: () => new Date("2026-06-11T09:00:00.000Z"),
        postDueMatchCards
      })
    ).resolves.toEqual({
      action: "posted",
      localDate: "2026-06-11",
      windowDays: 1,
      dates: [
        {
          date: "2026-06-11",
          posted: ["wc2026-001"],
          skipped: ["wc2026-002"]
        }
      ],
      posted: ["wc2026-001"],
      skipped: ["wc2026-002"]
    });
    expect(postDueMatchCards).toHaveBeenCalledWith("2026-06-11");
  });

  test("posts one day-level card for each date in the rolling window", async () => {
    const postDueMatchCards = vi
      .fn()
      .mockResolvedValueOnce({
        posted: ["wc2026-001"],
        skipped: []
      })
      .mockResolvedValueOnce({
        posted: ["wc2026-003", "wc2026-004"],
        skipped: ["wc2026-005"]
      })
      .mockResolvedValueOnce({
        posted: [],
        skipped: ["wc2026-006"]
      });

    await expect(
      runAutoPostTick({
        enabled: true,
        targetTime: "09:00",
        timeZone: "UTC",
        matchdayRolloverTime: "06:00",
        windowDays: 3,
        lastRunDate: null,
        now: () => new Date("2026-06-11T09:00:00.000Z"),
        postDueMatchCards
      })
    ).resolves.toEqual({
      action: "posted",
      localDate: "2026-06-11",
      windowDays: 3,
      dates: [
        { date: "2026-06-11", posted: ["wc2026-001"], skipped: [] },
        {
          date: "2026-06-12",
          posted: ["wc2026-003", "wc2026-004"],
          skipped: ["wc2026-005"]
        },
        { date: "2026-06-13", posted: [], skipped: ["wc2026-006"] }
      ],
      posted: ["wc2026-001", "wc2026-003", "wc2026-004"],
      skipped: ["wc2026-005", "wc2026-006"]
    });
    expect(postDueMatchCards).toHaveBeenNthCalledWith(1, "2026-06-11");
    expect(postDueMatchCards).toHaveBeenNthCalledWith(2, "2026-06-12");
    expect(postDueMatchCards).toHaveBeenNthCalledWith(3, "2026-06-13");
  });

  test("uses the previous matchday before the local rollover time", async () => {
    const postDueMatchCards = vi.fn(async () => ({
      posted: ["wc2026-008"],
      skipped: []
    }));

    await expect(
      runAutoPostTick({
        enabled: true,
        targetTime: "09:00",
        timeZone: "America/Sao_Paulo",
        matchdayRolloverTime: "06:00",
        windowDays: 1,
        lastRunDate: null,
        now: () => new Date("2026-06-14T03:15:00.000Z"),
        postDueMatchCards
      })
    ).resolves.toEqual({
      action: "posted",
      localDate: "2026-06-13",
      windowDays: 1,
      dates: [
        {
          date: "2026-06-13",
          posted: ["wc2026-008"],
          skipped: []
        }
      ],
      posted: ["wc2026-008"],
      skipped: []
    });
    expect(postDueMatchCards).toHaveBeenCalledWith("2026-06-13");
  });
});
