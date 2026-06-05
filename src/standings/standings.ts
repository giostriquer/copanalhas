import type { WorldCupMatch, WorldCupTeam } from "../worldcup/types.js";

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
  const groups = new Map<string, Map<string, MutableStandingRow>>();
  const matchesById = new Map(matches.map((match) => [match.id, match]));

  for (const match of matches) {
    ensureTeam(groups, match.group, match.homeTeam);
    ensureTeam(groups, match.group, match.awayTeam);
  }

  for (const result of results) {
    const match = matchesById.get(result.matchId);

    if (!match) {
      continue;
    }

    applyResult(
      getTeam(groups, match.group, match.homeTeam.code),
      getTeam(groups, match.group, match.awayTeam.code),
      result
    );
  }

  return [...groups.entries()]
    .sort(([leftGroup], [rightGroup]) => leftGroup.localeCompare(rightGroup))
    .map(([group, teamRows]) => ({
      group,
      rows: rankRows([...teamRows.values()])
    }));
}

function ensureTeam(
  groups: Map<string, Map<string, MutableStandingRow>>,
  group: string,
  team: WorldCupTeam
): void {
  const groupRows = groups.get(group) ?? new Map<string, MutableStandingRow>();

  if (!groups.has(group)) {
    groups.set(group, groupRows);
  }

  if (!groupRows.has(team.code)) {
    groupRows.set(team.code, {
      rank: 0,
      group,
      teamCode: team.code,
      teamName: team.name,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0
    });
  }
}

function getTeam(
  groups: Map<string, Map<string, MutableStandingRow>>,
  group: string,
  teamCode: string
): MutableStandingRow {
  const row = groups.get(group)?.get(teamCode);

  if (!row) {
    throw new Error(`Missing standings row for Group ${group} team ${teamCode}.`);
  }

  return row;
}

function applyResult(
  home: MutableStandingRow,
  away: MutableStandingRow,
  result: StandingsResult
): void {
  home.played += 1;
  away.played += 1;
  home.goalsFor += result.homeScore;
  home.goalsAgainst += result.awayScore;
  away.goalsFor += result.awayScore;
  away.goalsAgainst += result.homeScore;
  home.goalDifference = home.goalsFor - home.goalsAgainst;
  away.goalDifference = away.goalsFor - away.goalsAgainst;

  if (result.homeScore > result.awayScore) {
    home.wins += 1;
    away.losses += 1;
    home.points += 3;
    return;
  }

  if (result.homeScore < result.awayScore) {
    away.wins += 1;
    home.losses += 1;
    away.points += 3;
    return;
  }

  home.draws += 1;
  away.draws += 1;
  home.points += 1;
  away.points += 1;
}

function rankRows(rows: MutableStandingRow[]): GroupStandingRow[] {
  return rows
    .sort(compareRows)
    .map((row, index) => ({
      ...row,
      rank: index + 1
    }));
}

function compareRows(left: MutableStandingRow, right: MutableStandingRow): number {
  return (
    right.points - left.points ||
    right.goalDifference - left.goalDifference ||
    right.goalsFor - left.goalsFor ||
    left.teamName.localeCompare(right.teamName)
  );
}

type MutableStandingRow = GroupStandingRow;
