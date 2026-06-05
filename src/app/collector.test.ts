import { describe, expect, test, vi } from "vitest";

import { createPredictionPersistenceHandler } from "./collector.js";
import { WORLD_CUP_2026_SEED } from "../worldcup/seed.js";

describe("createPredictionPersistenceHandler", () => {
  test("stores accepted Discord predictions by match number", () => {
    const upsertPrediction = vi.fn();
    const handler = createPredictionPersistenceHandler({
      matches: WORLD_CUP_2026_SEED.matches,
      upsertPrediction,
      writeLine: () => undefined
    });

    handler({
      action: "accepted",
      prediction: {
        userId: "user-1",
        messageId: "message-1",
        matchNumber: 1,
        homeTeamCode: "MEX",
        awayTeamCode: "RSA",
        homeScore: 2,
        awayScore: 1,
        submittedAt: "2026-06-10T12:00:00.000Z",
        updatedAt: null,
        parserVersion: "prediction-parser-v1"
      }
    });

    expect(upsertPrediction).toHaveBeenCalledWith({
      userId: "user-1",
      matchId: "wc2026-001",
      messageId: "message-1",
      homeScore: 2,
      awayScore: 1,
      submittedAt: "2026-06-10T12:00:00.000Z",
      updatedAt: null,
      parserVersion: "prediction-parser-v1"
    });
  });

  test("does not store accepted predictions without a match number", () => {
    const upsertPrediction = vi.fn();
    const lines: string[] = [];
    const handler = createPredictionPersistenceHandler({
      matches: WORLD_CUP_2026_SEED.matches,
      upsertPrediction,
      writeLine: (line) => lines.push(line)
    });

    handler({
      action: "accepted",
      prediction: {
        userId: "user-1",
        messageId: "message-1",
        matchNumber: undefined,
        homeTeamCode: "MEX",
        awayTeamCode: "RSA",
        homeScore: 2,
        awayScore: 1,
        submittedAt: "2026-06-10T12:00:00.000Z",
        updatedAt: null,
        parserVersion: "prediction-parser-v1"
      }
    });

    expect(upsertPrediction).not.toHaveBeenCalled();
    expect(lines).toEqual(["Ignored prediction message-1: missing match number"]);
  });

  test("does not store accepted predictions for unknown match numbers", () => {
    const upsertPrediction = vi.fn();
    const lines: string[] = [];
    const handler = createPredictionPersistenceHandler({
      matches: WORLD_CUP_2026_SEED.matches,
      upsertPrediction,
      writeLine: (line) => lines.push(line)
    });

    handler({
      action: "accepted",
      prediction: {
        userId: "user-1",
        messageId: "message-1",
        matchNumber: 999,
        homeTeamCode: "MEX",
        awayTeamCode: "RSA",
        homeScore: 2,
        awayScore: 1,
        submittedAt: "2026-06-10T12:00:00.000Z",
        updatedAt: null,
        parserVersion: "prediction-parser-v1"
      }
    });

    expect(upsertPrediction).not.toHaveBeenCalled();
    expect(lines).toEqual(["Ignored prediction message-1: unknown match number 999"]);
  });
});
