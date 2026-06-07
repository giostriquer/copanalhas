import { describe, expect, test } from "vitest";

import { formatLockedPredictionRevealBatch } from "./locked-reveal.js";
import type { StoredPrediction } from "../storage/database.js";
import type { WorldCupMatch } from "../worldcup/types.js";

describe("formatLockedPredictionRevealBatch", () => {
  test("formats a compact thread post for one or more locked matches", () => {
    expect(
      formatLockedPredictionRevealBatch({
        matches: [
          match("wc2026-053", 53, "CZE", "Czechia", "MEX", "Mexico"),
          match("wc2026-054", 54, "RSA", "South Africa", "KOR", "Korea Republic")
        ],
        predictions: [
          prediction("user-2", "wc2026-053", 0, 2, "2026-06-24T10:05:00.000Z"),
          prediction("user-1", "wc2026-053", 1, 2, "2026-06-24T10:00:00.000Z"),
          prediction("user-1", "wc2026-054", 0, 1, "2026-06-24T10:10:00.000Z")
        ]
      })
    ).toBe(
      [
        "Palpites encerrados",
        "",
        "#53 Tchéquia x México",
        "2 palpites",
        "<@user-1>  1x2",
        "<@user-2>  0x2",
        "",
        "#54 África do Sul x Coreia do Sul",
        "1 palpite",
        "<@user-1>  0x1"
      ].join("\n")
    );
  });

  test("shows an empty state for locked matches without predictions", () => {
    expect(
      formatLockedPredictionRevealBatch({
        matches: [match("wc2026-001", 1, "MEX", "Mexico", "RSA", "South Africa")],
        predictions: []
      })
    ).toContain("Nenhum palpite enviado.");
  });
});

function prediction(
  userId: string,
  matchId: string,
  homeScore: number,
  awayScore: number,
  submittedAt: string
): StoredPrediction {
  return {
    userId,
    matchId,
    messageId: `message-${userId}-${matchId}`,
    homeScore,
    awayScore,
    submittedAt,
    updatedAt: null,
    parserVersion: "prediction-modal-v1"
  };
}

function match(
  id: string,
  matchNumber: number,
  homeCode: string,
  homeName: string,
  awayCode: string,
  awayName: string
): WorldCupMatch {
  return {
    id,
    matchNumber,
    phase: "group",
    group: "A",
    homeTeam: { code: homeCode, name: homeName },
    awayTeam: { code: awayCode, name: awayName },
    localDate: "2026-06-24",
    kickoffTimeLocal: "19:00",
    kickoffAtUtc: "2026-06-25T01:00:00.000Z",
    venue: "Test Stadium",
    sourceId: "test-source",
    externalIds: {}
  };
}
