import type { GroupStandingRow, StandingsResult } from "../standings/standings.js";
import {
  FIFA_2026_ANNEX_C_COLUMNS,
  FIFA_2026_ANNEX_C_ROWS
} from "./fifa-annex-c.js";
import { FIFA_2026_REVIEWED_TIEBREAKER_ORDERS } from "./reviewed-tiebreakers.js";
import { isGroupStageMatch, type WorldCupGroupMatch, type WorldCupMatch, type WorldCupTeam } from "./types.js";

export { FIFA_2026_ANNEX_C_COLUMNS, FIFA_2026_ANNEX_C_ROWS } from "./fifa-annex-c.js";

export const FIFA_2026_GROUP_CODES = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L"
] as const;

export type FifaGroupCode = (typeof FIFA_2026_GROUP_CODES)[number];
export type FifaQualificationStatus = "resolved" | "needs-manual-tiebreaker";
export type AnnexCWinnerSlot = (typeof FIFA_2026_ANNEX_C_COLUMNS)[number];
export type ThirdPlaceSlot = `3${FifaGroupCode}`;
export type QualificationSlot = `1${FifaGroupCode}` | `2${FifaGroupCode}` | ThirdPlaceSlot;

export const FIFA_2026_ROUND_OF_32_THIRD_PLACE_ALLOWED_GROUPS = {
  "1A": ["C", "E", "F", "H", "I"],
  "1B": ["E", "F", "G", "I", "J"],
  "1D": ["B", "E", "F", "I", "J"],
  "1E": ["A", "B", "C", "D", "F"],
  "1G": ["A", "E", "H", "I", "J"],
  "1I": ["C", "D", "F", "G", "H"],
  "1K": ["D", "E", "I", "J", "L"],
  "1L": ["E", "H", "I", "J", "K"]
} as const satisfies Record<AnnexCWinnerSlot, readonly FifaGroupCode[]>;

export interface FifaGroupStandings {
  group: string;
  status: FifaQualificationStatus;
  rows: FifaGroupStandingRow[];
}

export interface FifaGroupStandingRow extends GroupStandingRow {
  tiebreakerStatus: FifaQualificationStatus;
}

export interface AnnexCThirdPlaceAssignments {
  option: number;
  assignments: Record<AnnexCWinnerSlot, ThirdPlaceSlot>;
}

export interface ResolvedRoundOf32Fixture {
  matchNumber: number;
  homeSlot: QualificationSlot;
  awaySlot: QualificationSlot;
  homeTeam: WorldCupTeam;
  awayTeam: WorldCupTeam;
}

export interface ComputeFifaGroupStandingsOptions {
  reviewedTiebreakerOrders?: readonly FifaReviewedTiebreakerOrder[];
}

export interface FifaReviewedTiebreakerOrder {
  group: FifaGroupCode;
  orderedTeamCodes: readonly string[];
  appliesTo: readonly FifaReviewedTiebreakerRowSnapshot[];
  reason: "team-conduct" | "fifa-ranking" | "official-standings";
  source: string;
  reviewedAt: string;
}

export interface FifaReviewedTiebreakerRowSnapshot {
  teamCode: string;
  played: number;
  points: number;
  goalDifference: number;
  goalsFor: number;
  goalsAgainst: number;
}

const fifaGroupCodeSet = new Set<string>(FIFA_2026_GROUP_CODES);

const roundOf32Templates = [
  { matchNumber: 73, homeSlot: "2A", awaySlot: "2B" },
  { matchNumber: 74, homeSlot: "1E", thirdPlaceWinnerSlot: "1E" },
  { matchNumber: 75, homeSlot: "1F", awaySlot: "2C" },
  { matchNumber: 76, homeSlot: "1C", awaySlot: "2F" },
  { matchNumber: 77, homeSlot: "1I", thirdPlaceWinnerSlot: "1I" },
  { matchNumber: 78, homeSlot: "2E", awaySlot: "2I" },
  { matchNumber: 79, homeSlot: "1A", thirdPlaceWinnerSlot: "1A" },
  { matchNumber: 80, homeSlot: "1L", thirdPlaceWinnerSlot: "1L" },
  { matchNumber: 81, homeSlot: "1D", thirdPlaceWinnerSlot: "1D" },
  { matchNumber: 82, homeSlot: "1G", thirdPlaceWinnerSlot: "1G" },
  { matchNumber: 83, homeSlot: "2K", awaySlot: "2L" },
  { matchNumber: 84, homeSlot: "1H", awaySlot: "2J" },
  { matchNumber: 85, homeSlot: "1B", thirdPlaceWinnerSlot: "1B" },
  { matchNumber: 86, homeSlot: "1J", awaySlot: "2H" },
  { matchNumber: 87, homeSlot: "1K", thirdPlaceWinnerSlot: "1K" },
  { matchNumber: 88, homeSlot: "2D", awaySlot: "2G" }
] as const;

export function computeFifaGroupStandings(
  matches: readonly WorldCupMatch[],
  results: readonly StandingsResult[],
  options: ComputeFifaGroupStandingsOptions = {}
): FifaGroupStandings[] {
  const groupMatches = matches.filter(isGroupStageMatch);
  const groups = new Map<string, Map<string, MutableFifaGroupStandingRow>>();
  const playedMatches = new Map<string, PlayedGroupMatch[]>();
  const matchesById = new Map(groupMatches.map((match) => [match.id, match]));
  const reviewedTiebreakerOrders =
    options.reviewedTiebreakerOrders ?? FIFA_2026_REVIEWED_TIEBREAKER_ORDERS;

  for (const match of groupMatches) {
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
    recordPlayedMatch(playedMatches, match, result);
  }

  return [...groups.entries()]
    .sort(([leftGroup], [rightGroup]) => leftGroup.localeCompare(rightGroup))
    .map(([group, teamRows]) => {
      const ranked = rankFifaRows(
        [...teamRows.values()],
        playedMatches.get(group) ?? [],
        reviewedTiebreakerOrders.filter((order) => order.group === group)
      );

      return {
        group,
        status: ranked.status,
        rows: ranked.rows
      };
    });
}

export function resolveAnnexCThirdPlaceAssignments(
  qualifiedThirdGroups: readonly FifaGroupCode[]
): AnnexCThirdPlaceAssignments {
  const normalizedGroups = normalizeQualifiedThirdGroups(qualifiedThirdGroups);
  const key = combinationKey(normalizedGroups);
  const row = FIFA_2026_ANNEX_C_ROWS.find(
    (candidate) => combinationKey(candidate.assignments) === key
  );

  if (!row) {
    throw new Error(`No FIFA Annexe C row found for third-place groups ${key}.`);
  }

  const assignments = Object.fromEntries(
    FIFA_2026_ANNEX_C_COLUMNS.map((slot, index) => {
      const group = row.assignments[index];

      if (!isFifaGroupCode(group)) {
        throw new Error(`Invalid FIFA Annexe C assignment for ${slot} in option ${row.option}.`);
      }

      if (!isAllowedThirdPlaceAssignment(slot, group)) {
        throw new Error(`FIFA Annexe C option ${row.option} assigns 3${group} outside ${slot}'s pool.`);
      }

      return [slot, `3${group}`];
    })
  ) as Record<AnnexCWinnerSlot, ThirdPlaceSlot>;

  return {
    option: row.option,
    assignments
  };
}

export function resolveWorldCup2026RoundOf32(
  matches: readonly WorldCupMatch[],
  results: readonly StandingsResult[]
): ResolvedRoundOf32Fixture[] {
  const groupMatches = matches.filter(isGroupStageMatch);

  assertCompleteGroupResults(groupMatches, results);

  const standings = computeFifaGroupStandings(groupMatches, results);
  const standingsByGroup = new Map(standings.map((group) => [group.group, group]));
  const slotTeams = new Map<QualificationSlot, WorldCupTeam>();
  const thirdPlacedRows: FifaGroupStandingRow[] = [];

  for (const group of FIFA_2026_GROUP_CODES) {
    const standing = standingsByGroup.get(group);

    if (!standing) {
      throw new Error(`Missing standings for Group ${group}.`);
    }

    if (standing.status !== "resolved") {
      throw new Error(`Group ${group} needs manual tiebreaker data before knockout slots can be resolved.`);
    }

    const winner = standing.rows[0];
    const runnerUp = standing.rows[1];
    const thirdPlace = standing.rows[2];

    if (!winner || !runnerUp || !thirdPlace) {
      throw new Error(`Group ${group} does not have enough teams to resolve knockout slots.`);
    }

    slotTeams.set(`1${group}`, teamFromRow(winner));
    slotTeams.set(`2${group}`, teamFromRow(runnerUp));
    slotTeams.set(`3${group}`, teamFromRow(thirdPlace));
    thirdPlacedRows.push(thirdPlace);
  }

  const thirdPlaceRanking = rankThirdPlacedRows(thirdPlacedRows);

  if (thirdPlaceRanking.status !== "resolved") {
    throw new Error(
      "The eighth best third-place cutoff needs manual tiebreaker data before knockout slots can be resolved."
    );
  }

  const qualifiedThirdGroups = thirdPlaceRanking.rows
    .slice(0, 8)
    .map((row) => assertFifaGroupCode(row.group));
  const thirdPlaceAssignments = resolveAnnexCThirdPlaceAssignments(qualifiedThirdGroups);

  return roundOf32Templates.map((template) => {
    const homeSlot = template.homeSlot as QualificationSlot;
    const awaySlot = (
      "thirdPlaceWinnerSlot" in template
        ? thirdPlaceAssignments.assignments[template.thirdPlaceWinnerSlot]
        : template.awaySlot
    ) as QualificationSlot;

    return {
      matchNumber: template.matchNumber,
      homeSlot,
      awaySlot,
      homeTeam: teamForSlot(slotTeams, homeSlot),
      awayTeam: teamForSlot(slotTeams, awaySlot)
    };
  });
}

function ensureTeam(
  groups: Map<string, Map<string, MutableFifaGroupStandingRow>>,
  group: string,
  team: WorldCupTeam
): void {
  const groupRows = groups.get(group) ?? new Map<string, MutableFifaGroupStandingRow>();

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
      points: 0,
      tiebreakerStatus: "resolved"
    });
  }
}

function assertCompleteGroupResults(
  matches: readonly WorldCupGroupMatch[],
  results: readonly StandingsResult[]
): void {
  const resultMatchIds = new Set(results.map((result) => result.matchId));
  const resolvedMatchCount = matches.filter((match) => resultMatchIds.has(match.id)).length;

  if (resolvedMatchCount !== matches.length) {
    throw new Error(
      `Cannot resolve World Cup 2026 round of 32 before all group results are available (${resolvedMatchCount}/${matches.length}).`
    );
  }
}

function getTeam(
  groups: Map<string, Map<string, MutableFifaGroupStandingRow>>,
  group: string,
  teamCode: string
): MutableFifaGroupStandingRow {
  const row = groups.get(group)?.get(teamCode);

  if (!row) {
    throw new Error(`Missing standings row for Group ${group} team ${teamCode}.`);
  }

  return row;
}

function applyResult(
  home: MutableFifaGroupStandingRow,
  away: MutableFifaGroupStandingRow,
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

function recordPlayedMatch(
  playedMatches: Map<string, PlayedGroupMatch[]>,
  match: WorldCupGroupMatch,
  result: StandingsResult
): void {
  const groupMatches = playedMatches.get(match.group) ?? [];

  groupMatches.push({
    homeTeamCode: match.homeTeam.code,
    awayTeamCode: match.awayTeam.code,
    homeScore: result.homeScore,
    awayScore: result.awayScore
  });
  playedMatches.set(match.group, groupMatches);
}

function rankFifaRows(
  rows: MutableFifaGroupStandingRow[],
  playedMatches: readonly PlayedGroupMatch[],
  reviewedTiebreakerOrders: readonly FifaReviewedTiebreakerOrder[]
): { status: FifaQualificationStatus; rows: FifaGroupStandingRow[] } {
  const pointGroups = splitByScore(rows, (row) => row.points);
  const rankedRows: MutableFifaGroupStandingRow[] = [];
  const unresolvedTeamCodes = new Set<string>();

  for (const pointGroup of pointGroups) {
    const rankedPointGroup = rankEqualPointRows(
      pointGroup,
      playedMatches,
      reviewedTiebreakerOrders
    );

    rankedRows.push(...rankedPointGroup.rows);
    for (const teamCode of rankedPointGroup.unresolvedTeamCodes) {
      unresolvedTeamCodes.add(teamCode);
    }
  }

  return {
    status: unresolvedTeamCodes.size === 0 ? "resolved" : "needs-manual-tiebreaker",
    rows: rankedRows.map((row, index) => ({
      ...row,
      rank: index + 1,
      tiebreakerStatus: unresolvedTeamCodes.has(row.teamCode)
        ? "needs-manual-tiebreaker"
        : "resolved"
    }))
  };
}

function rankEqualPointRows(
  rows: readonly MutableFifaGroupStandingRow[],
  playedMatches: readonly PlayedGroupMatch[],
  reviewedTiebreakerOrders: readonly FifaReviewedTiebreakerOrder[]
): { rows: MutableFifaGroupStandingRow[]; unresolvedTeamCodes: Set<string> } {
  const headToHeadGroups = splitByHeadToHeadUntilStable(rows, playedMatches);
  const rankedRows: MutableFifaGroupStandingRow[] = [];
  const unresolvedTeamCodes = new Set<string>();

  for (const group of headToHeadGroups) {
    const allMatchGroups = splitBySequentialScores(group, [
      (row) => row.goalDifference,
      (row) => row.goalsFor
    ]);

    for (const allMatchGroup of allMatchGroups) {
      const reviewedOrder = reviewedTiebreakerOrderForRows(
        allMatchGroup,
        reviewedTiebreakerOrders
      );

      if (reviewedOrder) {
        rankedRows.push(...sortRowsByReviewedOrder(allMatchGroup, reviewedOrder));
        continue;
      }

      if (allMatchGroup.length > 1) {
        for (const row of allMatchGroup) {
          unresolvedTeamCodes.add(row.teamCode);
        }
      }

      rankedRows.push(...sortRowsByName(allMatchGroup));
    }
  }

  return { rows: rankedRows, unresolvedTeamCodes };
}

function reviewedTiebreakerOrderForRows(
  rows: readonly MutableFifaGroupStandingRow[],
  reviewedTiebreakerOrders: readonly FifaReviewedTiebreakerOrder[]
): FifaReviewedTiebreakerOrder | undefined {
  if (rows.length <= 1) {
    return undefined;
  }

  return reviewedTiebreakerOrders.find((order) => reviewedOrderMatchesRows(order, rows));
}

function reviewedOrderMatchesRows(
  order: FifaReviewedTiebreakerOrder,
  rows: readonly MutableFifaGroupStandingRow[]
): boolean {
  if (!sameTeamCodes(rows.map((row) => row.teamCode), order.orderedTeamCodes)) {
    return false;
  }

  if (
    !sameTeamCodes(
      rows.map((row) => row.teamCode),
      order.appliesTo.map((row) => row.teamCode)
    )
  ) {
    return false;
  }

  return rows.every((row) => {
    const expected = order.appliesTo.find((candidate) => candidate.teamCode === row.teamCode);

    return (
      expected !== undefined &&
      expected.played === row.played &&
      expected.points === row.points &&
      expected.goalDifference === row.goalDifference &&
      expected.goalsFor === row.goalsFor &&
      expected.goalsAgainst === row.goalsAgainst
    );
  });
}

function sameTeamCodes(left: readonly string[], right: readonly string[]): boolean {
  return (
    left.length === right.length &&
    left.toSorted().join("|") === right.toSorted().join("|")
  );
}

function sortRowsByReviewedOrder<T extends NamedTeamRow & { teamCode: string }>(
  rows: readonly T[],
  order: FifaReviewedTiebreakerOrder
): T[] {
  const orderIndexes = new Map(
    order.orderedTeamCodes.map((teamCode, index) => [teamCode, index])
  );

  return [...rows].sort(
    (left, right) =>
      (orderIndexes.get(left.teamCode) ?? Number.MAX_SAFE_INTEGER) -
      (orderIndexes.get(right.teamCode) ?? Number.MAX_SAFE_INTEGER)
  );
}

function splitByHeadToHeadUntilStable(
  rows: readonly MutableFifaGroupStandingRow[],
  playedMatches: readonly PlayedGroupMatch[]
): MutableFifaGroupStandingRow[][] {
  let groups = [sortRowsByName(rows)];
  let changed = true;

  while (changed) {
    changed = false;
    const nextGroups: MutableFifaGroupStandingRow[][] = [];

    for (const group of groups) {
      if (group.length <= 1) {
        nextGroups.push(group);
        continue;
      }

      const split = splitByHeadToHeadOnce(group, playedMatches);

      if (split.length > 1) {
        changed = true;
      }

      nextGroups.push(...split);
    }

    groups = nextGroups;
  }

  return groups;
}

function splitByHeadToHeadOnce(
  rows: readonly MutableFifaGroupStandingRow[],
  playedMatches: readonly PlayedGroupMatch[]
): MutableFifaGroupStandingRow[][] {
  const stats = computeHeadToHeadStats(rows, playedMatches);

  return splitBySequentialScores(rows, [
    (row) => stats.get(row.teamCode)?.points ?? 0,
    (row) => stats.get(row.teamCode)?.goalDifference ?? 0,
    (row) => stats.get(row.teamCode)?.goalsFor ?? 0
  ]);
}

function computeHeadToHeadStats(
  rows: readonly MutableFifaGroupStandingRow[],
  playedMatches: readonly PlayedGroupMatch[]
): Map<string, HeadToHeadStats> {
  const teamCodes = new Set(rows.map((row) => row.teamCode));
  const stats = new Map<string, HeadToHeadStats>(
    rows.map((row) => [
      row.teamCode,
      {
        points: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0
      }
    ])
  );

  for (const match of playedMatches) {
    if (!teamCodes.has(match.homeTeamCode) || !teamCodes.has(match.awayTeamCode)) {
      continue;
    }

    const home = stats.get(match.homeTeamCode);
    const away = stats.get(match.awayTeamCode);

    if (!home || !away) {
      throw new Error("Missing head-to-head stats for tied teams.");
    }

    home.goalsFor += match.homeScore;
    home.goalsAgainst += match.awayScore;
    away.goalsFor += match.awayScore;
    away.goalsAgainst += match.homeScore;
    home.goalDifference = home.goalsFor - home.goalsAgainst;
    away.goalDifference = away.goalsFor - away.goalsAgainst;

    if (match.homeScore > match.awayScore) {
      home.points += 3;
    } else if (match.homeScore < match.awayScore) {
      away.points += 3;
    } else {
      home.points += 1;
      away.points += 1;
    }
  }

  return stats;
}

export function rankThirdPlacedRows(
  rows: readonly FifaGroupStandingRow[]
): { status: FifaQualificationStatus; rows: FifaGroupStandingRow[] } {
  const scoreGroups = splitBySequentialScores(rows, [
    (row) => row.points,
    (row) => row.goalDifference,
    (row) => row.goalsFor
  ]);
  let offset = 0;
  let needsManualTiebreaker = false;

  for (const group of scoreGroups) {
    const start = offset;
    const end = offset + group.length - 1;

    if (group.length > 1 && start < 8 && end >= 8) {
      needsManualTiebreaker = true;
    }

    offset += group.length;
  }

  return {
    status: needsManualTiebreaker ? "needs-manual-tiebreaker" : "resolved",
    rows: scoreGroups.flatMap((group) => sortRowsByGroup(group))
  };
}

function splitBySequentialScores<T extends NamedTeamRow>(
  rows: readonly T[],
  scoreFns: ReadonlyArray<(row: T) => number>
): T[][] {
  return scoreFns.reduce<T[][]>(
    (groups, scoreFn) =>
      groups.flatMap((group) => (group.length <= 1 ? [group] : splitByScore(group, scoreFn))),
    [sortRowsByName(rows)]
  );
}

function splitByScore<T extends NamedTeamRow>(
  rows: readonly T[],
  scoreFn: (row: T) => number
): T[][] {
  const sortedRows = sortRowsByName(rows).toSorted((left, right) => scoreFn(right) - scoreFn(left));
  const groups: T[][] = [];

  for (const row of sortedRows) {
    const lastGroup = groups.at(-1);
    const lastRow = lastGroup?.[0];

    if (!lastGroup || !lastRow || scoreFn(lastRow) !== scoreFn(row)) {
      groups.push([row]);
      continue;
    }

    lastGroup.push(row);
  }

  return groups;
}

function sortRowsByName<T extends NamedTeamRow>(rows: readonly T[]): T[] {
  return [...rows].sort((left, right) => left.teamName.localeCompare(right.teamName));
}

function sortRowsByGroup<T extends { group: string }>(rows: readonly T[]): T[] {
  return [...rows].sort((left, right) => left.group.localeCompare(right.group));
}

function normalizeQualifiedThirdGroups(groups: readonly FifaGroupCode[]): FifaGroupCode[] {
  if (groups.length !== 8) {
    throw new Error(`Expected exactly eight third-place groups, received ${groups.length}.`);
  }

  const uniqueGroups = [...new Set(groups)];

  if (uniqueGroups.length !== groups.length) {
    throw new Error("Expected eight unique third-place groups.");
  }

  for (const group of uniqueGroups) {
    assertFifaGroupCode(group);
  }

  return uniqueGroups;
}

function combinationKey(groups: readonly string[]): string {
  return [...groups].toSorted().join("");
}

function teamFromRow(row: FifaGroupStandingRow): WorldCupTeam {
  return {
    code: row.teamCode,
    name: row.teamName
  };
}

function teamForSlot(
  slotTeams: ReadonlyMap<QualificationSlot, WorldCupTeam>,
  slot: QualificationSlot
): WorldCupTeam {
  const team = slotTeams.get(slot);

  if (!team) {
    throw new Error(`Missing team for qualification slot ${slot}.`);
  }

  return team;
}

function isAllowedThirdPlaceAssignment(slot: AnnexCWinnerSlot, group: FifaGroupCode): boolean {
  const allowedGroups = FIFA_2026_ROUND_OF_32_THIRD_PLACE_ALLOWED_GROUPS[
    slot
  ] as readonly FifaGroupCode[];

  return allowedGroups.includes(group);
}

function assertFifaGroupCode(group: string): FifaGroupCode {
  if (!isFifaGroupCode(group)) {
    throw new Error(`Unsupported FIFA World Cup 2026 group ${group}.`);
  }

  return group;
}

function isFifaGroupCode(group: string | undefined): group is FifaGroupCode {
  return group !== undefined && fifaGroupCodeSet.has(group);
}

interface NamedTeamRow {
  teamName: string;
}

interface MutableFifaGroupStandingRow extends FifaGroupStandingRow {}

interface PlayedGroupMatch {
  homeTeamCode: string;
  awayTeamCode: string;
  homeScore: number;
  awayScore: number;
}

interface HeadToHeadStats {
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
}
