import { computeFifaGroupStandings } from "../worldcup/fifa-qualification.js";
import type { WorldCupMatch } from "../worldcup/types.js";

export interface StandingsResult {
  matchId: string;
  homeScore: number;
  awayScore: number;
}

export interface GroupStandings {
  group: string;
  rows: GroupStandingRow[];
}

export interface GroupStandingRow {
  rank: number;
  group: string;
  teamCode: string;
  teamName: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export function computeGroupStandings(
  matches: readonly WorldCupMatch[],
  results: readonly StandingsResult[]
): GroupStandings[] {
  return computeFifaGroupStandings(matches, results).map(({ group, rows }) => ({
    group,
    rows: rows.map((row) => {
      const { tiebreakerStatus: _tiebreakerStatus, ...publicRow } = row;

      return publicRow;
    })
  }));
}
