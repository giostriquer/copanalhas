import { describe, expect, test } from "vitest";

import { parseScoreInput } from "./score-parser.js";

describe("parseScoreInput", () => {
  test.each([
    ["2x1", 2, 1],
    ["2 x 1", 2, 1],
    ["2-1", 2, 1],
    ["  10 x 0  ", 10, 0]
  ])("parses %s", (input, homeScore, awayScore) => {
    expect(parseScoreInput(input)).toEqual({
      ok: true,
      score: {
        homeScore,
        awayScore,
        normalizedText: `${homeScore}-${awayScore}`
      }
    });
  });

  test.each(["", "2", "2x", "x1", "-1x0", "1x-1", "one x zero", "2x1x0"])(
    "rejects invalid score %s",
    (input) => {
      expect(parseScoreInput(input)).toEqual({
        ok: false,
        reason: "invalid-score-format"
      });
    }
  );
});
