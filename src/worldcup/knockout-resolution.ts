import type { StandingsResult } from "../standings/standings.js";
import {
  computeFifaGroupStandings,
  resolveWorldCup2026RoundOf32
} from "./fifa-qualification.js";
import { isGroupStageMatch, type WorldCupGroupMatch, type WorldCupMatch, type WorldCupTeam } from "./types.js";

type KnockoutWinnerResult = StandingsResult & { winner?: "home" | "away" | null };

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
  resolveFixedRoundOf32Slots(matches, matchesByNumber, results);

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

function resolveFixedRoundOf32Slots(
  matches: readonly WorldCupMatch[],
  matchesByNumber: Map<number, WorldCupMatch>,
  results: readonly StandingsResult[]
): void {
  const slotTeams = qualificationSlotsForCompletedGroups(matches.filter(isGroupStageMatch), results);

  if (slotTeams.size === 0) {
    return;
  }

  for (const match of matchesByNumber.values()) {
    if (match.phase !== "round_of_32") {
      continue;
    }

    const homeTeam = slotTeams.get(match.homeTeam.code);
    const awayTeam = slotTeams.get(match.awayTeam.code);

    if (homeTeam) {
      match.homeTeam = { ...homeTeam };
    }

    if (awayTeam) {
      match.awayTeam = { ...awayTeam };
    }
  }
}

function qualificationSlotsForCompletedGroups(
  groupMatches: readonly WorldCupGroupMatch[],
  results: readonly StandingsResult[]
): Map<string, WorldCupTeam> {
  const resultMatchIds = new Set(results.map((result) => result.matchId));
  const completedGroups = new Set<string>();

  for (const [group, matches] of groupMatchesByGroup(groupMatches)) {
    if (matches.length > 0 && matches.every((match) => resultMatchIds.has(match.id))) {
      completedGroups.add(group);
    }
  }

  const slotTeams = new Map<string, WorldCupTeam>();

  for (const standing of computeFifaGroupStandings(groupMatches, results)) {
    if (!completedGroups.has(standing.group) || standing.status !== "resolved") {
      continue;
    }

    for (const rank of [1, 2, 3] as const) {
      const row = standing.rows[rank - 1];

      if (row) {
        slotTeams.set(`${rank}${standing.group}`, {
          code: row.teamCode,
          name: row.teamName
        });
      }
    }
  }

  return slotTeams;
}

function groupMatchesByGroup(
  matches: readonly WorldCupGroupMatch[]
): Map<string, WorldCupGroupMatch[]> {
  const grouped = new Map<string, WorldCupGroupMatch[]>();

  for (const match of matches) {
    const group = grouped.get(match.group) ?? [];
    group.push(match);
    grouped.set(match.group, group);
  }

  return grouped;
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

  if (!sourceMatch || !sourceResult) {
    return undefined;
  }

  const winner = winnerForResult(sourceResult);

  if (!winner) {
    return undefined;
  }

  const homeWon = winner === "home";
  const winningTeam = homeWon ? sourceMatch.homeTeam : sourceMatch.awayTeam;
  const loser = homeWon ? sourceMatch.awayTeam : sourceMatch.homeTeam;

  return { ...(parsed.groups.kind === "W" ? winningTeam : loser) };
}

function winnerForResult(result: StandingsResult): "home" | "away" | undefined {
  if (result.homeScore > result.awayScore) {
    return "home";
  }

  if (result.awayScore > result.homeScore) {
    return "away";
  }

  const storedWinner = (result as KnockoutWinnerResult).winner;

  return storedWinner === "home" || storedWinner === "away" ? storedWinner : undefined;
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
