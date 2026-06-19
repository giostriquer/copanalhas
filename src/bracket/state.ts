import type { StandingsResult } from "../standings/standings.js";
import {
  computeFifaGroupStandings,
  resolveAnnexCThirdPlaceAssignments,
  resolveWorldCup2026RoundOf32,
  type AnnexCThirdPlaceAssignments,
  type FifaGroupCode,
  type FifaGroupStandingRow,
  type ResolvedRoundOf32Fixture
} from "../worldcup/fifa-qualification.js";
import type { WorldCupMatch, WorldCupTeam } from "../worldcup/types.js";
import {
  ROUND_OF_32_TEMPLATES,
  VISUAL_SKELETON_ROUNDS,
  type RoundOf32Template
} from "./template.js";
import type { BracketEntrant, BracketMatch, BracketRound, BracketState } from "./types.js";

export interface CreateBracketStateOptions {
  matches: readonly WorldCupMatch[];
  results: readonly StandingsResult[];
}

export function createBracketState(options: CreateBracketStateOptions): BracketState {
  const groupMatches = options.matches.filter((match) => match.phase === "group");

  if (hasCompleteGroupResults(groupMatches, options.results)) {
    try {
      return createFinalBracketState(resolveWorldCup2026RoundOf32(groupMatches, options.results));
    } catch (error) {
      if (!isManualTiebreakerError(error)) {
        throw error;
      }

      return createBlockedBracketState(groupMatches, options.results, error);
    }
  }

  return createProvisionalBracketState(groupMatches, options.results);
}

function createProvisionalBracketState(
  groupMatches: readonly WorldCupMatch[],
  results: readonly StandingsResult[]
): BracketState {
  const standings = computeFifaGroupStandings(groupMatches, results);
  const slotEntrants = new Map<string, BracketEntrant>();

  for (const standing of standings) {
    for (const row of standing.rows.slice(0, 3)) {
      const sourceSlot = `${row.rank}${standing.group}`;

      slotEntrants.set(sourceSlot, {
        label: row.teamCode,
        teamCode: row.teamCode,
        teamName: row.teamName,
        sourceSlot,
        ...(row.tiebreakerStatus === "needs-manual-tiebreaker"
          ? { warning: "tie-order-provisional" as const }
          : {})
      });
    }
  }

  const thirdPlaceRows = standings
    .map((standing) => standing.rows[2])
    .filter((row): row is FifaGroupStandingRow => row !== undefined)
    .toSorted(compareThirdPlaceRows);
  const thirdPlaceCutoffWarning =
    thirdPlaceRows[7] !== undefined &&
    thirdPlaceRows[8] !== undefined &&
    compareThirdPlaceScores(thirdPlaceRows[7], thirdPlaceRows[8]) === 0;
  const thirdPlaceGroups = thirdPlaceRows
    .slice(0, 8)
    .map((row) => row.group as FifaGroupCode);
  const thirdPlaceAssignments =
    thirdPlaceGroups.length === 8
      ? resolveAnnexCThirdPlaceAssignments(thirdPlaceGroups).assignments
      : undefined;

  return {
    phase: "provisional",
    notes: [
      "Round of 32 entrants are provisional until all group results and tiebreakers are resolved.",
      "Later rounds are visual placeholders until reviewed knockout topology is available."
    ],
    rounds: [
      round(
        "round_of_32",
        "Round of 32",
        ROUND_OF_32_TEMPLATES.map((template, index) => ({
          id: `r32-${template.matchNumber}`,
          label: `#${template.matchNumber}`,
          state: "provisional",
          home: entrantForSlot(template.homeSlot, slotEntrants, false),
          away: entrantForSlot(
            awaySlotForTemplate(template, thirdPlaceAssignments) || `OPEN-${index + 1}`,
            slotEntrants,
            thirdPlaceCutoffWarning
          )
        }))
      ),
      ...visualSkeletonRounds()
    ]
  };
}

function createFinalBracketState(fixtures: readonly ResolvedRoundOf32Fixture[]): BracketState {
  return {
    phase: "final",
    notes: [
      "Round of 32 entrants are resolved from complete group-stage results.",
      "Later rounds are visual placeholders until reviewed knockout topology is available."
    ],
    rounds: [
      round(
        "round_of_32",
        "Round of 32",
        fixtures.map((fixture) => ({
          id: `r32-${fixture.matchNumber}`,
          label: `#${fixture.matchNumber}`,
          state: "final",
          home: resolvedEntrant(fixture.homeSlot, fixture.homeTeam),
          away: resolvedEntrant(fixture.awaySlot, fixture.awayTeam)
        }))
      ),
      ...visualSkeletonRounds()
    ]
  };
}

function createBlockedBracketState(
  groupMatches: readonly WorldCupMatch[],
  results: readonly StandingsResult[],
  error: unknown
): BracketState {
  const provisionalState = createProvisionalBracketState(groupMatches, results);

  return {
    ...provisionalState,
    phase: "blocked",
    notes: [
      `Round of 32 cannot be finalized: ${errorMessage(error)}`,
      "Manual tiebreaker data is required before final bracket entrants can be published."
    ],
    rounds: provisionalState.rounds.map((roundState) =>
      roundState.key === "round_of_32"
        ? {
            ...roundState,
            matches: roundState.matches.map((match) => ({
              ...match,
              state: "blocked"
            }))
          }
        : roundState
    )
  };
}

function hasCompleteGroupResults(
  groupMatches: readonly WorldCupMatch[],
  results: readonly StandingsResult[]
): boolean {
  const resultMatchIds = new Set(results.map((result) => result.matchId));

  return groupMatches.length > 0 && groupMatches.every((match) => resultMatchIds.has(match.id));
}

function compareThirdPlaceRows(left: FifaGroupStandingRow, right: FifaGroupStandingRow): number {
  return compareThirdPlaceScores(left, right) || left.group.localeCompare(right.group);
}

function compareThirdPlaceScores(left: FifaGroupStandingRow, right: FifaGroupStandingRow): number {
  return right.points - left.points || right.goalDifference - left.goalDifference || right.goalsFor - left.goalsFor;
}

function awaySlotForTemplate(
  template: RoundOf32Template,
  thirdPlaceAssignments: AnnexCThirdPlaceAssignments["assignments"] | undefined
): string {
  if (template.awaySlot) {
    return template.awaySlot;
  }

  if (template.thirdPlaceWinnerSlot && thirdPlaceAssignments) {
    return thirdPlaceAssignments[template.thirdPlaceWinnerSlot];
  }

  return "";
}

function entrantForSlot(
  slot: string,
  slotEntrants: ReadonlyMap<string, BracketEntrant>,
  thirdPlaceCutoffWarning: boolean
): BracketEntrant {
  const entrant = slotEntrants.get(slot) ?? placeholder(slot);

  if (thirdPlaceCutoffWarning && slot.startsWith("3")) {
    return { ...entrant, warning: "tie-order-provisional" };
  }

  return entrant;
}

function resolvedEntrant(slot: string, team: WorldCupTeam): BracketEntrant {
  return {
    label: team.code,
    teamCode: team.code,
    teamName: team.name,
    sourceSlot: slot
  };
}

function visualSkeletonRounds(): BracketRound[] {
  return VISUAL_SKELETON_ROUNDS.map((template) =>
    winnerRound(template.key, template.label, template.matchCount, template.sourcePrefix)
  );
}

function round(key: BracketRound["key"], label: string, matches: BracketMatch[]): BracketRound {
  return { key, label, matches };
}

function winnerRound(
  key: BracketRound["key"],
  label: string,
  count: number,
  prefix: string
): BracketRound {
  return round(
    key,
    label,
    Array.from({ length: count }, (_, index) => ({
      id: `${key}-${index + 1}`,
      label,
      state: "scheduled",
      home: placeholder(`${prefix}-${index * 2 + 1}`),
      away: placeholder(`${prefix}-${index * 2 + 2}`)
    }))
  );
}

function placeholder(label: string): BracketEntrant {
  return { label, sourceSlot: label };
}

function isManualTiebreakerError(error: unknown): boolean {
  return errorMessage(error).toLowerCase().includes("manual tiebreaker");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
