import { describe, expect, test } from "vitest";

import { WORLD_CUP_2026_SEED } from "./seed.js";
import { validateTournamentSeed } from "./validate.js";

describe("validateTournamentSeed", () => {
  test("accepts the reviewed World Cup 2026 seed", () => {
    expect(validateTournamentSeed(WORLD_CUP_2026_SEED)).toEqual({
      ok: true,
      errors: []
    });
  });

  test("rejects duplicate match ids", () => {
    const firstMatch = seedMatch(0);
    const secondMatch = seedMatch(1);
    const rest = WORLD_CUP_2026_SEED.matches.slice(2);

    expect(
      validateTournamentSeed({
        ...WORLD_CUP_2026_SEED,
        matches: [firstMatch, { ...secondMatch, id: firstMatch.id }, ...rest]
      })
    ).toEqual({
      ok: false,
      errors: [`Duplicate match id ${firstMatch.id}`]
    });
  });

  test("rejects missing source metadata", () => {
    expect(
      validateTournamentSeed({
        ...WORLD_CUP_2026_SEED,
        sources: []
      })
    ).toEqual({
      ok: false,
      errors: ["At least one source is required"]
    });
  });

  test("rejects invalid local dates", () => {
    const firstMatch = seedMatch(0);
    const rest = WORLD_CUP_2026_SEED.matches.slice(1);

    expect(
      validateTournamentSeed({
        ...WORLD_CUP_2026_SEED,
        matches: [{ ...firstMatch, localDate: "11/06/2026" }, ...rest]
      })
    ).toEqual({
      ok: false,
      errors: [`${firstMatch.id} has invalid localDate 11/06/2026`]
    });
  });

  test("rejects same-team fixtures", () => {
    const firstMatch = seedMatch(0);
    const rest = WORLD_CUP_2026_SEED.matches.slice(1);

    expect(
      validateTournamentSeed({
        ...WORLD_CUP_2026_SEED,
        matches: [
          {
            ...firstMatch,
            awayTeam: firstMatch.homeTeam
          },
          ...rest
        ]
      })
    ).toEqual({
      ok: false,
      errors: [`${firstMatch.id} has the same home and away team code`]
    });
  });
});

function seedMatch(index: number) {
  const match = WORLD_CUP_2026_SEED.matches[index];

  if (!match) {
    throw new Error(`Missing seed match at index ${index}`);
  }

  return match;
}
