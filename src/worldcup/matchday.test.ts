import { describe, expect, test } from "vitest";

import {
  getMatchdayDateForInstant,
  getMatchdayDateForMatch,
  getMatchdayDateTimeParts
} from "./matchday.js";
import { WORLD_CUP_2026_SEED } from "./seed.js";

describe("operational matchdays", () => {
  test("keeps after-midnight local matches on the previous matchday before rollover", () => {
    const lateMatch = WORLD_CUP_2026_SEED.matches.find((match) => match.matchNumber === 8);

    if (!lateMatch) {
      throw new Error("expected match #8");
    }

    expect(getMatchdayDateForMatch(lateMatch, "America/Sao_Paulo", "06:00")).toBe(
      "2026-06-13"
    );
  });

  test("uses the current local date once the rollover time has arrived", () => {
    expect(
      getMatchdayDateForInstant(
        new Date("2026-06-14T09:00:00.000Z"),
        "America/Sao_Paulo",
        "06:00"
      )
    ).toBe("2026-06-14");
  });

  test("returns a comparison time that lets catch-up run after midnight", () => {
    expect(
      getMatchdayDateTimeParts(
        new Date("2026-06-14T03:15:00.000Z"),
        "America/Sao_Paulo",
        "06:00"
      )
    ).toEqual({
      matchdayDate: "2026-06-13",
      localDate: "2026-06-14",
      localTime: "00:15",
      dailyJobTime: "24:15"
    });
  });
});
