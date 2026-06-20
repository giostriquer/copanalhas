import { describe, expect, test } from "vitest";

import { formatLockedPredictionRevealBatch, formatPredictionResultRevealBatch } from "./locked-reveal.js";
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
        "",
        "==== México ====",
        "<@user-1>  1x2",
        "<@user-2>  0x2",
        "",
        "#54 África do Sul x Coreia do Sul",
        "1 palpite",
        "",
        "==== Coreia do Sul ====",
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

  test("groups locked predictions by score before submission time", () => {
    expect(
      formatLockedPredictionRevealBatch({
        matches: [match("wc2026-001", 1, "MEX", "Mexico", "RSA", "South Africa")],
        predictions: [
          prediction("user-1", "wc2026-001", 2, 0, "2026-06-11T10:00:00.000Z"),
          prediction("user-2", "wc2026-001", 3, 1, "2026-06-11T10:05:00.000Z"),
          prediction("user-3", "wc2026-001", 2, 0, "2026-06-11T10:02:00.000Z"),
          prediction("user-4", "wc2026-001", 2, 1, "2026-06-11T10:01:00.000Z")
        ]
      })
    ).toBe(
      [
        "Palpites encerrados",
        "",
        "#1 México x África do Sul",
        "4 palpites",
        "",
        "==== México ====",
        "<@user-1>  2x0",
        "<@user-3>  2x0",
        "------ Solo",
        "<@user-2>  3x1",
        "<@user-4>  2x1"
      ].join("\n")
    );
  });

  test("groups locked predictions by predicted outcome with solo score callouts", () => {
    expect(
      formatLockedPredictionRevealBatch({
        matches: [match("wc2026-001", 1, "GER", "Germany", "CIV", "Cote d'Ivoire")],
        predictions: [
          prediction("user-1", "wc2026-001", 5, 1, "2026-06-11T10:00:00.000Z"),
          prediction("user-2", "wc2026-001", 5, 1, "2026-06-11T10:01:00.000Z"),
          prediction("user-3", "wc2026-001", 4, 1, "2026-06-11T10:02:00.000Z"),
          prediction("user-4", "wc2026-001", 4, 1, "2026-06-11T10:03:00.000Z"),
          prediction("user-5", "wc2026-001", 4, 0, "2026-06-11T10:04:00.000Z"),
          prediction("user-6", "wc2026-001", 0, 2, "2026-06-11T10:05:00.000Z"),
          prediction("user-7", "wc2026-001", 1, 1, "2026-06-11T10:06:00.000Z")
        ]
      })
    ).toBe(
      [
        "Palpites encerrados",
        "",
        "#1 Alemanha x Costa do Marfim",
        "7 palpites",
        "",
        "==== Alemanha ====",
        "<@user-1>  5x1",
        "<@user-2>  5x1",
        "<@user-3>  4x1",
        "<@user-4>  4x1",
        "------ Solo",
        "<@user-5>  4x0",
        "",
        "==== Costa do Marfim ====",
        "<@user-6>  0x2",
        "",
        "==== Empate ====",
        "<@user-7>  1x1"
      ].join("\n")
    );
  });
});

describe("formatPredictionResultRevealBatch", () => {
  test("formats the final result and points gained for each prediction", () => {
    expect(
      formatPredictionResultRevealBatch({
        matches: [match("wc2026-001", 1, "MEX", "Mexico", "RSA", "South Africa")],
        predictions: [
          prediction("user-1", "wc2026-001", 2, 1, "2026-06-11T10:05:00.000Z"),
          prediction("user-2", "wc2026-001", 1, 0, "2026-06-11T10:00:00.000Z"),
          prediction("user-3", "wc2026-001", 0, 0, "2026-06-11T10:10:00.000Z")
        ],
        results: [{ matchId: "wc2026-001", homeScore: 1, awayScore: 0 }]
      })
    ).toBe(
      [
        "Resultado",
        "",
        "#1 México (1) x (0) África do Sul",
        "3 palpites",
        "<@user-1>  2x1 - 0 pts",
        "<@user-2>  1x0 - 5 pts",
        "<@user-3>  0x0 - 0 pts"
      ].join("\n")
    );
  });

  test("shows correct-winner points when nobody lands the exact score", () => {
    expect(
      formatPredictionResultRevealBatch({
        matches: [match("wc2026-001", 1, "MEX", "Mexico", "RSA", "South Africa")],
        predictions: [
          prediction("user-1", "wc2026-001", 3, 1, "2026-06-11T10:05:00.000Z"),
          prediction("user-2", "wc2026-001", 1, 0, "2026-06-11T10:00:00.000Z"),
          prediction("user-3", "wc2026-001", 0, 1, "2026-06-11T10:10:00.000Z")
        ],
        results: [{ matchId: "wc2026-001", homeScore: 2, awayScore: 0 }]
      })
    ).toBe(
      [
        "Resultado",
        "",
        "#1 México (2) x (0) África do Sul",
        "3 palpites",
        "<@user-1>  3x1 - 2 pts",
        "<@user-2>  1x0 - 2 pts",
        "<@user-3>  0x1 - 0 pts"
      ].join("\n")
    );
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
