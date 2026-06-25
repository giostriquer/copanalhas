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

  test("contains all reviewed tournament fixtures with kickoff times", () => {
    const groupMatches = WORLD_CUP_2026_SEED.matches.filter((match) => match.phase === "group");
    const knockoutMatches = WORLD_CUP_2026_SEED.matches.filter(
      (match) => match.phase !== "group"
    );

    expect(WORLD_CUP_2026_SEED.matches).toHaveLength(104);
    expect(groupMatches).toHaveLength(72);
    expect(knockoutMatches).toHaveLength(32);
    expect(WORLD_CUP_2026_SEED.matches.every((match) => match.kickoffAtUtc)).toBe(true);
    expect(WORLD_CUP_2026_SEED.matches.every((match) => match.kickoffTimeLocal)).toBe(true);
    expect(WORLD_CUP_2026_SEED.matches.every((match) => match.externalIds.footballData)).toBe(
      true
    );
  });

  test("includes reviewed knockout metadata for prediction windows and bracket labels", () => {
    expect(seedMatchByNumber(73)).toMatchObject({
      id: "wc2026-073",
      matchNumber: 73,
      phase: "round_of_32",
      group: null,
      homeTeam: { code: "2A", name: "2º Grupo A" },
      awayTeam: { code: "2B", name: "2º Grupo B" },
      localDate: "2026-06-28",
      kickoffTimeLocal: "12:00",
      kickoffAtUtc: "2026-06-28T19:00:00.000Z",
      venue: "Los Angeles Stadium",
      externalIds: { footballData: 537417 }
    });
    expect(seedMatchByNumber(104)).toMatchObject({
      id: "wc2026-104",
      matchNumber: 104,
      phase: "final",
      group: null,
      homeTeam: { code: "W101", name: "Vencedor #101" },
      awayTeam: { code: "W102", name: "Vencedor #102" },
      localDate: "2026-07-19",
      kickoffTimeLocal: "15:00",
      kickoffAtUtc: "2026-07-19T19:00:00.000Z",
      venue: "New York New Jersey Stadium"
    });
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

function seedMatchByNumber(matchNumber: number) {
  const match = WORLD_CUP_2026_SEED.matches.find(
    (candidate) => candidate.matchNumber === matchNumber
  );

  if (!match) {
    throw new Error(`Missing seed match #${matchNumber}`);
  }

  return match;
}
