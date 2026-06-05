import { describe, expect, test } from "vitest";

import {
  canSubmitPredictionAt,
  formatPredictionWindow,
  getPredictionWindow
} from "./cutoff.js";
import type { WorldCupMatch } from "./types.js";

describe("prediction cutoff", () => {
  test("closes predictions 30 minutes before kickoff", () => {
    const match = timedMatch("2026-06-11T19:00:00.000Z");

    expect(getPredictionWindow(match)).toEqual({
      kickoffAtUtc: "2026-06-11T19:00:00.000Z",
      closesAtUtc: "2026-06-11T18:30:00.000Z"
    });
    expect(canSubmitPredictionAt(match, new Date("2026-06-11T18:29:59.000Z"))).toEqual({
      ok: true,
      closesAtUtc: "2026-06-11T18:30:00.000Z"
    });
    expect(canSubmitPredictionAt(match, new Date("2026-06-11T18:30:00.000Z"))).toEqual({
      ok: false,
      reason: "closed",
      closesAtUtc: "2026-06-11T18:30:00.000Z"
    });
  });

  test("rejects predictions when kickoff time is not verified", () => {
    const match = timedMatch(null);

    expect(getPredictionWindow(match)).toEqual({
      kickoffAtUtc: null,
      closesAtUtc: null
    });
    expect(canSubmitPredictionAt(match, new Date("2026-06-11T12:00:00.000Z"))).toEqual({
      ok: false,
      reason: "missing-kickoff"
    });
  });

  test("formats kickoff and close time for match cards", () => {
    expect(formatPredictionWindow(timedMatch("2026-06-11T19:00:00.000Z"), "UTC")).toEqual({
      kickoffText: "Kickoff: <t:1781204400:F> (<t:1781204400:R>)",
      closesText: "Predictions close: <t:1781202600:F> (<t:1781202600:R>)"
    });
  });
});

function timedMatch(kickoffAtUtc: string | null): WorldCupMatch {
  return {
    id: "wc2026-001",
    matchNumber: 1,
    phase: "group",
    group: "A",
    homeTeam: { code: "MEX", name: "Mexico" },
    awayTeam: { code: "RSA", name: "South Africa" },
    localDate: "2026-06-11",
    kickoffTimeLocal: null,
    kickoffAtUtc,
    venue: "Mexico City Stadium",
    sourceId: "test-source",
    externalIds: {}
  };
}
