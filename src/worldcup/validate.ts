import type { TournamentSeed } from "./types.js";

export interface TournamentSeedValidation {
  ok: boolean;
  errors: string[];
}

const datePattern = /^\d{4}-\d{2}-\d{2}$/u;
const timePattern = /^\d{2}:\d{2}$/u;
const utcTimestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u;

export function validateTournamentSeed(seed: TournamentSeed): TournamentSeedValidation {
  const errors: string[] = [];
  const sourceIds = new Set(seed.sources.map((source) => source.id));

  if (seed.sources.length === 0) {
    errors.push("At least one source is required");
  }

  const matchIds = new Set<string>();
  const matchNumbers = new Set<number>();

  for (const match of seed.matches) {
    if (matchIds.has(match.id)) {
      errors.push(`Duplicate match id ${match.id}`);
    }
    matchIds.add(match.id);

    if (matchNumbers.has(match.matchNumber)) {
      errors.push(`Duplicate match number ${match.matchNumber}`);
    }
    matchNumbers.add(match.matchNumber);

    if (!datePattern.test(match.localDate)) {
      errors.push(`${match.id} has invalid localDate ${match.localDate}`);
    }

    if (match.kickoffTimeLocal !== null && !timePattern.test(match.kickoffTimeLocal)) {
      errors.push(`${match.id} has invalid kickoffTimeLocal ${match.kickoffTimeLocal}`);
    }

    if (match.kickoffAtUtc !== null && !isValidUtcTimestamp(match.kickoffAtUtc)) {
      errors.push(`${match.id} has invalid kickoffAtUtc ${match.kickoffAtUtc}`);
    }

    if (
      match.externalIds.footballData !== undefined &&
      (!Number.isInteger(match.externalIds.footballData) || match.externalIds.footballData <= 0)
    ) {
      errors.push(`${match.id} has invalid football-data match id ${match.externalIds.footballData}`);
    }

    if (match.homeTeam.code === match.awayTeam.code) {
      errors.push(`${match.id} has the same home and away team code`);
    }

    if (seed.sources.length > 0 && !sourceIds.has(match.sourceId)) {
      errors.push(`${match.id} references unknown source ${match.sourceId}`);
    }
  }

  return {
    ok: errors.length === 0,
    errors
  };
}

function isValidUtcTimestamp(value: string): boolean {
  return utcTimestampPattern.test(value) && !Number.isNaN(Date.parse(value));
}
