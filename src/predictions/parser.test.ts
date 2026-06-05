import { describe, expect, test } from "vitest";

import { parsePredictionMessage } from "./parser.js";

describe("parsePredictionMessage", () => {
  test("parses a simple scoreline prediction", () => {
    const result = parsePredictionMessage("MEX 2-1 POR");

    expect(result).toEqual({
      ok: true,
      prediction: {
        matchNumber: undefined,
        homeTeamCode: "MEX",
        awayTeamCode: "POR",
        homeScore: 2,
        awayScore: 1,
        normalizedText: "MEX 2-1 POR"
      }
    });
  });

  test("parses an explicit match number and x separator", () => {
    const result = parsePredictionMessage("  #1  mex 2 x 1 por  ");

    expect(result).toEqual({
      ok: true,
      prediction: {
        matchNumber: 1,
        homeTeamCode: "MEX",
        awayTeamCode: "POR",
        homeScore: 2,
        awayScore: 1,
        normalizedText: "#1 MEX 2-1 POR"
      }
    });
  });

  test("rejects chatter instead of guessing", () => {
    const result = parsePredictionMessage("I think Mexico wins 2-1");

    expect(result).toEqual({
      ok: false,
      reason: "unsupported-format"
    });
  });

  test("rejects messages with extra predictions", () => {
    const result = parsePredictionMessage("MEX 2-1 POR and BRA 1-0 ESP");

    expect(result).toEqual({
      ok: false,
      reason: "unsupported-format"
    });
  });

  test("rejects negative scores", () => {
    const result = parsePredictionMessage("MEX -1-0 POR");

    expect(result).toEqual({
      ok: false,
      reason: "unsupported-format"
    });
  });

  test("rejects same-team predictions", () => {
    const result = parsePredictionMessage("BRA 1-0 bra");

    expect(result).toEqual({
      ok: false,
      reason: "same-team"
    });
  });
});
