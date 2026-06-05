import { describe, expect, test } from "vitest";

import {
  formatPredictionAudit,
  formatPredictionReveal
} from "./visibility.js";
import type { StoredPrediction } from "../storage/database.js";
import { WORLD_CUP_2026_SEED } from "../worldcup/seed.js";

describe("prediction visibility formatting", () => {
  test("formats a private operator audit while predictions are open", () => {
    const message = formatPredictionAudit({
      match: firstSeedMatch(),
      predictions: [
        prediction("user-1", 2, 1, "2026-06-10T12:00:00.000Z"),
        prediction("user-2", 2, 2, "2026-06-10T12:30:00.000Z")
      ],
      now: new Date("2026-06-10T13:00:00.000Z")
    });

    expect(message).toBe(
      [
        "Prediction Audit",
        "Match #1 - Mexico vs South Africa",
        "Window: open, closes <t:1781202600:R>",
        "",
        "2 submitted",
        "<@user-1>  2x1  submitted <t:1781092800:R>",
        "<@user-2>  2x2  submitted <t:1781094600:R>"
      ].join("\n")
    );
  });

  test("refuses a public reveal while predictions are still open", () => {
    const reveal = formatPredictionReveal({
      match: firstSeedMatch(),
      predictions: [prediction("user-1", 2, 1, "2026-06-10T12:00:00.000Z")],
      now: new Date("2026-06-10T13:00:00.000Z")
    });

    expect(reveal).toEqual({
      ok: false,
      content: [
        "Predictions are still open for Match #1 - Mexico vs South Africa.",
        "Public reveal unlocks when predictions close: <t:1781202600:F> (<t:1781202600:R>)."
      ].join("\n")
    });
  });

  test("formats a public reveal after predictions close", () => {
    const reveal = formatPredictionReveal({
      match: firstSeedMatch(),
      predictions: [
        prediction("user-1", 2, 1, "2026-06-10T12:00:00.000Z"),
        prediction("user-2", 2, 2, "2026-06-10T12:30:00.000Z")
      ],
      now: new Date("2026-06-11T18:30:00.000Z")
    });

    expect(reveal).toEqual({
      ok: true,
      content: [
        "Picks are locked for Match #1",
        "Mexico vs South Africa",
        "",
        "2 submitted",
        "<@user-1>  2x1",
        "<@user-2>  2x2"
      ].join("\n")
    });
  });

  test("formats an empty prediction list", () => {
    expect(
      formatPredictionAudit({
        match: firstSeedMatch(),
        predictions: [],
        now: new Date("2026-06-10T13:00:00.000Z")
      })
    ).toBe(
      [
        "Prediction Audit",
        "Match #1 - Mexico vs South Africa",
        "Window: open, closes <t:1781202600:R>",
        "",
        "No predictions yet."
      ].join("\n")
    );
  });
});

function firstSeedMatch() {
  const match = WORLD_CUP_2026_SEED.matches[0];

  if (!match) {
    throw new Error("World Cup seed needs at least one match");
  }

  return match;
}

function prediction(
  userId: string,
  homeScore: number,
  awayScore: number,
  submittedAt: string
): StoredPrediction {
  return {
    userId,
    matchId: "wc2026-001",
    messageId: `interaction-${userId}`,
    homeScore,
    awayScore,
    submittedAt,
    updatedAt: null,
    parserVersion: "prediction-modal-v1"
  };
}
