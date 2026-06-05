import { describe, expect, test } from "vitest";

import { formatUserPredictionSummary } from "./personal-summary.js";
import type { StoredPrediction } from "../storage/database.js";
import type { WorldCupMatch } from "../worldcup/types.js";

describe("formatUserPredictionSummary", () => {
  test("renders only the requested date for one user", () => {
    const matches = [
      match("wc2026-001", 1, "2026-06-11", "MEX", "Mexico", "RSA", "South Africa"),
      match("wc2026-002", 2, "2026-06-11", "KOR", "Korea Republic", "CZE", "Czechia"),
      match("wc2026-003", 3, "2026-06-12", "ESP", "Spain", "URU", "Uruguay")
    ];

    expect(
      formatUserPredictionSummary({
        userId: "user-1",
        date: "2026-06-11",
        matches,
        predictions: [
          prediction("user-1", "wc2026-001", 2, 1),
          prediction("user-2", "wc2026-002", 1, 1),
          prediction("user-1", "wc2026-003", 0, 0)
        ]
      })
    ).toBe(
      [
        "Meus palpites - 2026-06-11",
        "#1 México x África do Sul: 2x1",
        "#2 Coreia do Sul x Tchéquia: sem palpite"
      ].join("\n")
    );
  });

  test("renders an empty date message when the date has no reviewed matches", () => {
    expect(
      formatUserPredictionSummary({
        userId: "user-1",
        date: "2026-06-30",
        matches: [],
        predictions: []
      })
    ).toBe("Nenhum jogo encontrado para 2026-06-30.");
  });
});

function prediction(
  userId: string,
  matchId: string,
  homeScore: number,
  awayScore: number
): StoredPrediction {
  return {
    userId,
    matchId,
    messageId: `interaction-${userId}-${matchId}`,
    homeScore,
    awayScore,
    submittedAt: "2026-06-10T12:00:00.000Z",
    updatedAt: null,
    parserVersion: "prediction-modal-v1"
  };
}

function match(
  id: string,
  matchNumber: number,
  localDate: string,
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
    localDate,
    kickoffTimeLocal: "13:00",
    kickoffAtUtc: "2026-06-11T19:00:00.000Z",
    venue: "Test Stadium",
    sourceId: "test-source",
    externalIds: {}
  };
}
