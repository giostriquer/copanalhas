import type { StandingsResult } from "../standings/standings.js";
import { resolveWorldCup2026RoundOf32 } from "./fifa-qualification.js";
import { isGroupStageMatch, type WorldCupMatch, type WorldCupTeam } from "./types.js";

export function resolveKnockoutMatchParticipants(
  matches: readonly WorldCupMatch[],
  results: readonly StandingsResult[]
): WorldCupMatch[] {
  const resolvedMatches = matches.map(cloneMatch);
  const matchesByNumber = new Map(resolvedMatches.map((match) => [match.matchNumber, match]));
  const resultsByMatchId = new Map(results.map((result) => [result.matchId, result]));

  resolveRoundOf32Participants(resolvedMatches, matchesByNumber, results);
  resolveWinnerLoserSlots(matchesByNumber, resultsByMatchId);

  return resolvedMatches;
}

function resolveRoundOf32Participants(
  matches: readonly WorldCupMatch[],
  matchesByNumber: Map<number, WorldCupMatch>,
  results: readonly StandingsResult[]
): void {
  try {
    for (const fixture of resolveWorldCup2026RoundOf32(matches.filter(isGroupStageMatch), results)) {
      const match = matchesByNumber.get(fixture.matchNumber);

      if (!match || match.phase !== "round_of_32") {
        continue;
      }

      match.homeTeam = { ...fixture.homeTeam };
      match.awayTeam = { ...fixture.awayTeam };
    }
  } catch (error) {
    if (!isExpectedUnresolvedKnockoutError(error)) {
      throw error;
    }
  }
}

function resolveWinnerLoserSlots(
  matchesByNumber: Map<number, WorldCupMatch>,
  resultsByMatchId: ReadonlyMap<string, StandingsResult>
): void {
  let changed = true;

  while (changed) {
    changed = false;

    for (const match of matchesByNumber.values()) {
      if (match.phase === "group") {
        continue;
      }

      const homeTeam = teamForReference(match.homeTeam.code, matchesByNumber, resultsByMatchId);
      const awayTeam = teamForReference(match.awayTeam.code, matchesByNumber, resultsByMatchId);

      if (homeTeam && homeTeam.code !== match.homeTeam.code) {
        match.homeTeam = homeTeam;
        changed = true;
      }

      if (awayTeam && awayTeam.code !== match.awayTeam.code) {
        match.awayTeam = awayTeam;
        changed = true;
      }
    }
  }
}

function teamForReference(
  reference: string,
  matchesByNumber: ReadonlyMap<number, WorldCupMatch>,
  resultsByMatchId: ReadonlyMap<string, StandingsResult>
): WorldCupTeam | undefined {
  const parsed = /^(?<kind>[WL])(?<matchNumber>\d+)$/u.exec(reference);

  if (!parsed?.groups?.kind || !parsed.groups.matchNumber) {
    return undefined;
  }

  const sourceMatch = matchesByNumber.get(Number.parseInt(parsed.groups.matchNumber, 10));
  const sourceResult = sourceMatch ? resultsByMatchId.get(sourceMatch.id) : undefined;

  if (!sourceMatch || !sourceResult || sourceResult.homeScore === sourceResult.awayScore) {
    return undefined;
  }

  const homeWon = sourceResult.homeScore > sourceResult.awayScore;
  const winner = homeWon ? sourceMatch.homeTeam : sourceMatch.awayTeam;
  const loser = homeWon ? sourceMatch.awayTeam : sourceMatch.homeTeam;

  return { ...(parsed.groups.kind === "W" ? winner : loser) };
}

function cloneMatch(match: WorldCupMatch): WorldCupMatch {
  return {
    ...match,
    homeTeam: { ...match.homeTeam },
    awayTeam: { ...match.awayTeam },
    externalIds: { ...match.externalIds }
  };
}

function isExpectedUnresolvedKnockoutError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);

  return (
    message.includes("Cannot resolve World Cup 2026 round of 32") ||
    message.includes("manual tiebreaker")
  );
}
