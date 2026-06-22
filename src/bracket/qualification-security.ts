import type { StandingsResult } from "../standings/standings.js";
import type { FifaGroupStandingRow, FifaGroupStandings } from "../worldcup/fifa-qualification.js";
import type { WorldCupMatch } from "../worldcup/types.js";
import type { QualificationSecurity } from "./types.js";

export function computeQualificationSecurityByTeamCode(
  groupMatches: readonly WorldCupMatch[],
  results: readonly StandingsResult[],
  standings: readonly FifaGroupStandings[]
): ReadonlyMap<string, QualificationSecurity> {
  const contextsByGroup = buildGroupContexts(groupMatches, results);
  const profilesByGroup = new Map<string, PointProfile[]>();
  const maxThirdPointsByGroup = new Map<string, number>();
  const securityByTeamCode = new Map<string, QualificationSecurity>();

  for (const [group, context] of contextsByGroup) {
    const profiles = enumeratePointProfiles(context);
    profilesByGroup.set(group, profiles);
    maxThirdPointsByGroup.set(group, maxThirdPlacePoints(profiles));
  }

  for (const standing of standings) {
    const profiles = profilesByGroup.get(standing.group);
    const context = contextsByGroup.get(standing.group);

    if (!profiles || !context) {
      continue;
    }

    for (const row of standing.rows) {
      securityByTeamCode.set(
        row.teamCode,
        qualificationSecurityForRow(row, standing, context, profiles, profilesByGroup, maxThirdPointsByGroup)
      );
    }
  }

  return securityByTeamCode;
}

function qualificationSecurityForRow(
  row: FifaGroupStandingRow,
  standing: FifaGroupStandings,
  context: GroupPointContext,
  profiles: readonly PointProfile[],
  profilesByGroup: ReadonlyMap<string, readonly PointProfile[]>,
  maxThirdPointsByGroup: ReadonlyMap<string, number>
): QualificationSecurity {
  if (row.rank <= 2 && context.remainingMatches.length === 0 && standing.status === "resolved") {
    return "locked-slot";
  }

  if (row.rank <= 2 && isExactRankLockedByPoints(profiles, row.teamCode, row.rank)) {
    return "locked-slot";
  }

  if (isGuaranteedTopTwoByPoints(profiles, row.teamCode)) {
    return "qualified-floating";
  }

  if (
    isGuaranteedThirdPlaceQualifierByPoints(
      profiles,
      profilesByGroup,
      maxThirdPointsByGroup,
      standing.group,
      row.teamCode
    )
  ) {
    return "qualified-floating";
  }

  return "not-secured";
}

function buildGroupContexts(
  groupMatches: readonly WorldCupMatch[],
  results: readonly StandingsResult[]
): Map<string, GroupPointContext> {
  const resultsByMatchId = new Map(results.map((result) => [result.matchId, result]));
  const contexts = new Map<string, GroupPointContext>();

  for (const match of groupMatches) {
    const context = groupContext(contexts, match.group);

    ensureTeamPoints(context, match.homeTeam.code);
    ensureTeamPoints(context, match.awayTeam.code);

    const result = resultsByMatchId.get(match.id);

    if (result) {
      applyResultPoints(context.pointsByTeamCode, match, result);
      continue;
    }

    context.remainingMatches.push({
      homeTeamCode: match.homeTeam.code,
      awayTeamCode: match.awayTeam.code
    });
  }

  return contexts;
}

function enumeratePointProfiles(context: GroupPointContext): PointProfile[] {
  const profiles: PointProfile[] = [];
  const initialPoints = new Map(context.pointsByTeamCode);

  enumerateRemainingMatchPoints(context.remainingMatches, 0, initialPoints, (pointsByTeamCode) => {
    profiles.push(new Map(pointsByTeamCode));
  });

  return profiles;
}

function enumerateRemainingMatchPoints(
  remainingMatches: readonly RemainingGroupMatch[],
  index: number,
  pointsByTeamCode: Map<string, number>,
  onProfile: (pointsByTeamCode: ReadonlyMap<string, number>) => void
): void {
  const match = remainingMatches[index];

  if (!match) {
    onProfile(pointsByTeamCode);
    return;
  }

  withPoints(pointsByTeamCode, match.homeTeamCode, 3, () => {
    enumerateRemainingMatchPoints(remainingMatches, index + 1, pointsByTeamCode, onProfile);
  });
  withPoints(pointsByTeamCode, match.homeTeamCode, 1, () => {
    withPoints(pointsByTeamCode, match.awayTeamCode, 1, () => {
      enumerateRemainingMatchPoints(remainingMatches, index + 1, pointsByTeamCode, onProfile);
    });
  });
  withPoints(pointsByTeamCode, match.awayTeamCode, 3, () => {
    enumerateRemainingMatchPoints(remainingMatches, index + 1, pointsByTeamCode, onProfile);
  });
}

function isExactRankLockedByPoints(
  profiles: readonly PointProfile[],
  teamCode: string,
  rank: number
): boolean {
  return profiles.every((profile) => {
    const teamPoints = pointsForTeam(profile, teamCode);
    const betterTeams = countOtherTeams(profile, teamCode, (points) => points > teamPoints);
    const tiedTeams = countOtherTeams(profile, teamCode, (points) => points === teamPoints);

    return betterTeams === rank - 1 && tiedTeams === 0;
  });
}

function isGuaranteedTopTwoByPoints(
  profiles: readonly PointProfile[],
  teamCode: string
): boolean {
  return profiles.every((profile) => {
    const teamPoints = pointsForTeam(profile, teamCode);

    return countOtherTeams(profile, teamCode, (points) => points >= teamPoints) <= 1;
  });
}

function isGuaranteedThirdPlaceQualifierByPoints(
  ownGroupProfiles: readonly PointProfile[],
  profilesByGroup: ReadonlyMap<string, readonly PointProfile[]>,
  maxThirdPointsByGroup: ReadonlyMap<string, number>,
  ownGroup: string,
  teamCode: string
): boolean {
  return ownGroupProfiles.every((profile) => {
    const teamPoints = pointsForTeam(profile, teamCode);
    const teamsAtOrAbove = countOtherTeams(profile, teamCode, (points) => points >= teamPoints);

    if (teamsAtOrAbove <= 1) {
      return true;
    }

    if (teamsAtOrAbove > 2) {
      return false;
    }

    return (
      countGroupsWithPotentialThirdPlaceAtLeast(
        profilesByGroup,
        maxThirdPointsByGroup,
        ownGroup,
        teamPoints
      ) <= 7
    );
  });
}

function countGroupsWithPotentialThirdPlaceAtLeast(
  profilesByGroup: ReadonlyMap<string, readonly PointProfile[]>,
  maxThirdPointsByGroup: ReadonlyMap<string, number>,
  ownGroup: string,
  teamPoints: number
): number {
  let count = 0;

  for (const group of profilesByGroup.keys()) {
    if (group === ownGroup) {
      continue;
    }

    if ((maxThirdPointsByGroup.get(group) ?? Number.POSITIVE_INFINITY) >= teamPoints) {
      count += 1;
    }
  }

  return count;
}

function maxThirdPlacePoints(profiles: readonly PointProfile[]): number {
  return Math.max(
    ...profiles.map((profile) => [...profile.values()].toSorted((left, right) => right - left)[2] ?? 0)
  );
}

function groupContext(
  contexts: Map<string, GroupPointContext>,
  group: string
): GroupPointContext {
  const existing = contexts.get(group);

  if (existing) {
    return existing;
  }

  const created: GroupPointContext = {
    group,
    pointsByTeamCode: new Map(),
    remainingMatches: []
  };
  contexts.set(group, created);

  return created;
}

function applyResultPoints(
  pointsByTeamCode: Map<string, number>,
  match: WorldCupMatch,
  result: StandingsResult
): void {
  if (result.homeScore > result.awayScore) {
    addPoints(pointsByTeamCode, match.homeTeam.code, 3);
    return;
  }

  if (result.homeScore < result.awayScore) {
    addPoints(pointsByTeamCode, match.awayTeam.code, 3);
    return;
  }

  addPoints(pointsByTeamCode, match.homeTeam.code, 1);
  addPoints(pointsByTeamCode, match.awayTeam.code, 1);
}

function ensureTeamPoints(context: GroupPointContext, teamCode: string): void {
  if (!context.pointsByTeamCode.has(teamCode)) {
    context.pointsByTeamCode.set(teamCode, 0);
  }
}

function withPoints(
  pointsByTeamCode: Map<string, number>,
  teamCode: string,
  points: number,
  callback: () => void
): void {
  addPoints(pointsByTeamCode, teamCode, points);
  callback();
  addPoints(pointsByTeamCode, teamCode, -points);
}

function addPoints(pointsByTeamCode: Map<string, number>, teamCode: string, points: number): void {
  pointsByTeamCode.set(teamCode, pointsForTeam(pointsByTeamCode, teamCode) + points);
}

function pointsForTeam(pointsByTeamCode: ReadonlyMap<string, number>, teamCode: string): number {
  return pointsByTeamCode.get(teamCode) ?? 0;
}

function countOtherTeams(
  pointsByTeamCode: ReadonlyMap<string, number>,
  teamCode: string,
  predicate: (points: number) => boolean
): number {
  let count = 0;

  for (const [candidateTeamCode, points] of pointsByTeamCode) {
    if (candidateTeamCode !== teamCode && predicate(points)) {
      count += 1;
    }
  }

  return count;
}

interface GroupPointContext {
  group: string;
  pointsByTeamCode: Map<string, number>;
  remainingMatches: RemainingGroupMatch[];
}

interface RemainingGroupMatch {
  homeTeamCode: string;
  awayTeamCode: string;
}

type PointProfile = ReadonlyMap<string, number>;
