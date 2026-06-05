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

  test("contains all reviewed group-stage fixtures with kickoff times", () => {
    expect(WORLD_CUP_2026_SEED.matches).toHaveLength(72);
    expect(WORLD_CUP_2026_SEED.matches.every((match) => match.phase === "group")).toBe(true);
    expect(WORLD_CUP_2026_SEED.matches.every((match) => match.kickoffAtUtc)).toBe(true);
    expect(WORLD_CUP_2026_SEED.matches.every((match) => match.kickoffTimeLocal)).toBe(true);
  });

  test("has the opening match day fixtures ready for auto-post smoke tests", () => {
    expect(
      WORLD_CUP_2026_SEED.matches
        .filter((match) => match.localDate === "2026-06-11")
        .map((match) => ({
          id: match.id,
          teams: `${match.homeTeam.name} vs ${match.awayTeam.name}`,
          kickoffAtUtc: match.kickoffAtUtc
        }))
    ).toEqual([
      {
        id: "wc2026-001",
        teams: "Mexico vs South Africa",
        kickoffAtUtc: "2026-06-11T19:00:00.000Z"
      },
      {
        id: "wc2026-002",
        teams: "Korea Republic vs Czechia",
        kickoffAtUtc: "2026-06-12T02:00:00.000Z"
      }
    ]);
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

  test("rejects invalid kickoff UTC timestamps", () => {
    const firstMatch = seedMatch(0);
    const rest = WORLD_CUP_2026_SEED.matches.slice(1);

    expect(
      validateTournamentSeed({
        ...WORLD_CUP_2026_SEED,
        matches: [{ ...firstMatch, kickoffAtUtc: "2026-06-11 19:00" }, ...rest]
      })
    ).toEqual({
      ok: false,
      errors: [`${firstMatch.id} has invalid kickoffAtUtc 2026-06-11 19:00`]
    });
  });

  test("rejects invalid football-data match ids", () => {
    const firstMatch = seedMatch(0);
    const rest = WORLD_CUP_2026_SEED.matches.slice(1);

    expect(
      validateTournamentSeed({
        ...WORLD_CUP_2026_SEED,
        matches: [{ ...firstMatch, externalIds: { footballData: 0 } }, ...rest]
      })
    ).toEqual({
      ok: false,
      errors: [`${firstMatch.id} has invalid football-data match id 0`]
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
