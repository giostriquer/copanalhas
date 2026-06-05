import type { TournamentSeed } from "./types.js";

export interface TournamentSeedValidation {
  ok: boolean;
  errors: string[];
}

const datePattern = /^\d{4}-\d{2}-\d{2}$/u;
const timePattern = /^\d{2}:\d{2}$/u;

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
