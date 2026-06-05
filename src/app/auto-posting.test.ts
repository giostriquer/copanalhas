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
        lastRunDate: null,
        now: () => new Date("2026-06-11T09:00:00.000Z"),
        postDueMatchCards
      })
    ).resolves.toEqual({
      action: "posted",
      localDate: "2026-06-11",
      posted: ["wc2026-001"],
      skipped: ["wc2026-002"]
    });
    expect(postDueMatchCards).toHaveBeenCalledWith("2026-06-11");
  });
});
