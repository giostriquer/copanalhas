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
import {
  isGroupStageMatch,
  type WorldCupGroupMatch,
  type WorldCupMatch,
  type WorldCupTeam
} from "../worldcup/types.js";
import { resolveKnockoutMatchParticipants } from "../worldcup/knockout-resolution.js";
import { computeQualificationSecurityByTeamCode } from "./qualification-security.js";
import {
  ROUND_OF_32_TEMPLATES,
  VISUAL_SKELETON_ROUNDS,
  type RoundOf32Template
} from "./template.js";
import type { BracketEntrant, BracketMatch, BracketRound, BracketState } from "./types.js";

type BracketResultDetails = StandingsResult & {
  decisionMethod?: "regular" | "extra_time" | "penalties" | null;
  regularTimeHomeScore?: number | null;
  regularTimeAwayScore?: number | null;
  extraTimeHomeScore?: number | null;
  extraTimeAwayScore?: number | null;
  penaltyHomeScore?: number | null;
  penaltyAwayScore?: number | null;
  winner?: "home" | "away" | null;
};

export interface CreateBracketStateOptions {
  matches: readonly WorldCupMatch[];
  results: readonly StandingsResult[];
  timeZone?: string;
}

export function createBracketState(options: CreateBracketStateOptions): BracketState {
  const groupMatches = options.matches.filter(isGroupStageMatch);
  const resolvedMatches = resolveKnockoutMatchParticipants(options.matches, options.results);
  const knockoutScheduleByNumber = knockoutScheduleByNumberForMatches(
    options.matches,
    options.timeZone ?? "America/Sao_Paulo"
  );

  if (hasCompleteGroupResults(groupMatches, options.results)) {
    try {
      return createFinalBracketState(
        resolveWorldCup2026RoundOf32(groupMatches, options.results),
        knockoutScheduleByNumber,
        resolvedMatches,
        options.results
      );
    } catch (error) {
      if (!isManualTiebreakerError(error)) {
        throw error;
      }

      return createBlockedBracketState(
        groupMatches,
        options.results,
        knockoutScheduleByNumber,
        error
      );
    }
  }

  return createProvisionalBracketState(groupMatches, options.results, knockoutScheduleByNumber);
}

function createProvisionalBracketState(
  groupMatches: readonly WorldCupGroupMatch[],
  results: readonly StandingsResult[],
  knockoutScheduleByNumber: ReadonlyMap<number, string>
): BracketState {
  const standings = computeFifaGroupStandings(groupMatches, results);
  const qualificationSecurityByTeamCode = computeQualificationSecurityByTeamCode(
    groupMatches,
    results,
    standings
  );
  const slotEntrants = new Map<string, BracketEntrant>();

  for (const standing of standings) {
    for (const row of standing.rows.slice(0, 3)) {
      const sourceSlot = `${row.rank}${standing.group}`;

      slotEntrants.set(sourceSlot, {
        label: row.teamCode,
        teamCode: row.teamCode,
        teamName: row.teamName,
        sourceSlot,
        qualificationSecurity: qualificationSecurityByTeamCode.get(row.teamCode) ?? "not-secured",
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
          ...kickoffLabelForMatchNumber(template.matchNumber, knockoutScheduleByNumber),
          home: entrantForSlot(template.homeSlot, slotEntrants, false),
          away: entrantForSlot(
            awaySlotForTemplate(template, thirdPlaceAssignments) || `OPEN-${index + 1}`,
            slotEntrants,
            thirdPlaceCutoffWarning
          )
        }))
      ),
      ...visualSkeletonRounds(knockoutScheduleByNumber)
    ]
  };
}

function createFinalBracketState(
  fixtures: readonly ResolvedRoundOf32Fixture[],
  knockoutScheduleByNumber: ReadonlyMap<number, string>,
  resolvedMatches: readonly WorldCupMatch[],
  results: readonly StandingsResult[]
): BracketState {
  const knockoutMatchesByNumber = new Map(
    resolvedMatches
      .filter((match) => match.phase !== "group")
      .map((match) => [match.matchNumber, match] as const)
  );
  const resultsByMatchId = new Map(results.map((result) => [result.matchId, result]));

  return {
    phase: "final",
    notes: [
      "Round of 32 entrants are resolved from complete group-stage results.",
      "Later rounds update from stored knockout results as matches finish."
    ],
    rounds: [
      round(
        "round_of_32",
        "Round of 32",
        fixtures.map((fixture) => {
          const match = knockoutMatchesByNumber.get(fixture.matchNumber);
          const result = match ? resultsByMatchId.get(match.id) : undefined;

          return {
            id: `r32-${fixture.matchNumber}`,
            label: `#${fixture.matchNumber}`,
            state: "final",
            ...kickoffLabelForMatchNumber(fixture.matchNumber, knockoutScheduleByNumber),
            ...scoreLabelsForResult(result),
            home: resolvedEntrant(fixture.homeSlot, fixture.homeTeam),
            away: resolvedEntrant(fixture.awaySlot, fixture.awayTeam)
          };
        })
      ),
      ...resolvedSkeletonRounds(knockoutMatchesByNumber, resultsByMatchId, knockoutScheduleByNumber)
    ]
  };
}

function createBlockedBracketState(
  groupMatches: readonly WorldCupGroupMatch[],
  results: readonly StandingsResult[],
  knockoutScheduleByNumber: ReadonlyMap<number, string>,
  error: unknown
): BracketState {
  const provisionalState = createProvisionalBracketState(
    groupMatches,
    results,
    knockoutScheduleByNumber
  );

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
  groupMatches: readonly WorldCupGroupMatch[],
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
    sourceSlot: slot,
    qualificationSecurity: "locked-slot"
  };
}

function entrantForKnockoutTeam(team: WorldCupTeam): BracketEntrant {
  if (isPlaceholderTeamCode(team.code)) {
    return { label: team.name, sourceSlot: team.code };
  }

  return {
    label: team.code,
    teamCode: team.code,
    teamName: team.name,
    sourceSlot: team.code
  };
}

function isPlaceholderTeamCode(code: string): boolean {
  return /^[123][A-L]$/u.test(code) || /^3[A-L]+$/u.test(code) || /^[WL]\d+$/u.test(code);
}

function scoreLabelsForResult(
  result: StandingsResult | undefined
): Pick<BracketMatch, "scoreLabel" | "homeScoreLabel" | "awayScoreLabel"> &
  Partial<Pick<BracketMatch, "scoreWinner">> {
  if (!result) {
    return {};
  }

  const details = result as BracketResultDetails;
  const scoreLabels = visibleScoreLabels(details);
  const winner = winnerForResult(details);

  return {
    scoreLabel: `${result.homeScore}-${result.awayScore}`,
    homeScoreLabel: scoreLabels.home,
    awayScoreLabel: scoreLabels.away,
    ...(winner ? { scoreWinner: winner } : {})
  };
}

function visibleScoreLabels(result: BracketResultDetails): { home: string; away: string } {
  if (
    result.decisionMethod === "penalties" &&
    result.penaltyHomeScore !== null &&
    result.penaltyHomeScore !== undefined &&
    result.penaltyAwayScore !== null &&
    result.penaltyAwayScore !== undefined
  ) {
    const baseScore = scoreBeforePenalties(result);

    return {
      home: `${baseScore.homeScore} (${result.penaltyHomeScore})`,
      away: `${baseScore.awayScore} (${result.penaltyAwayScore})`
    };
  }

  return {
    home: String(result.homeScore),
    away: String(result.awayScore)
  };
}

function scoreBeforePenalties(result: BracketResultDetails): {
  homeScore: number;
  awayScore: number;
} {
  if (
    result.extraTimeHomeScore !== null &&
    result.extraTimeHomeScore !== undefined &&
    result.extraTimeAwayScore !== null &&
    result.extraTimeAwayScore !== undefined
  ) {
    return {
      homeScore: result.extraTimeHomeScore,
      awayScore: result.extraTimeAwayScore
    };
  }

  if (
    result.regularTimeHomeScore !== null &&
    result.regularTimeHomeScore !== undefined &&
    result.regularTimeAwayScore !== null &&
    result.regularTimeAwayScore !== undefined
  ) {
    return {
      homeScore: result.regularTimeHomeScore,
      awayScore: result.regularTimeAwayScore
    };
  }

  return {
    homeScore: result.homeScore,
    awayScore: result.awayScore
  };
}

function winnerForResult(result: BracketResultDetails): "home" | "away" | undefined {
  if (result.winner === "home" || result.winner === "away") {
    return result.winner;
  }

  if (result.homeScore > result.awayScore) {
    return "home";
  }

  if (result.awayScore > result.homeScore) {
    return "away";
  }

  return undefined;
}

function visualSkeletonRounds(knockoutScheduleByNumber: ReadonlyMap<number, string>): BracketRound[] {
  return VISUAL_SKELETON_ROUNDS.map((template) =>
    winnerRound(
      template.key,
      template.label,
      template.matchNumbers,
      template.sourcePrefix,
      knockoutScheduleByNumber
    )
  );
}

function resolvedSkeletonRounds(
  knockoutMatchesByNumber: ReadonlyMap<number, WorldCupMatch>,
  resultsByMatchId: ReadonlyMap<string, StandingsResult>,
  knockoutScheduleByNumber: ReadonlyMap<number, string>
): BracketRound[] {
  return VISUAL_SKELETON_ROUNDS.map((template) =>
    round(
      template.key,
      template.label,
      template.matchNumbers.map((matchNumber, index) => {
        const match = knockoutMatchesByNumber.get(matchNumber);

        if (!match) {
          return {
            id: `${template.key}-${index + 1}`,
            label: `#${matchNumber}`,
            state: "scheduled",
            ...kickoffLabelForMatchNumber(matchNumber, knockoutScheduleByNumber),
            home: placeholder(`${template.sourcePrefix}-${index * 2 + 1}`),
            away: placeholder(`${template.sourcePrefix}-${index * 2 + 2}`)
          };
        }

        return {
          id: `${template.key}-${index + 1}`,
          label: `#${matchNumber}`,
          state: resultsByMatchId.has(match.id) ? "final" : "scheduled",
          ...kickoffLabelForMatchNumber(matchNumber, knockoutScheduleByNumber),
          ...scoreLabelsForResult(resultsByMatchId.get(match.id)),
          home: entrantForKnockoutTeam(match.homeTeam),
          away: entrantForKnockoutTeam(match.awayTeam)
        };
      })
    )
  );
}

function round(key: BracketRound["key"], label: string, matches: BracketMatch[]): BracketRound {
  return { key, label, matches };
}

function winnerRound(
  key: BracketRound["key"],
  label: string,
  matchNumbers: readonly number[],
  prefix: string,
  knockoutScheduleByNumber: ReadonlyMap<number, string>
): BracketRound {
  return round(
    key,
    label,
    matchNumbers.map((matchNumber, index) => ({
      id: `${key}-${index + 1}`,
      label: `#${matchNumber}`,
      state: "scheduled",
      ...kickoffLabelForMatchNumber(matchNumber, knockoutScheduleByNumber),
      home: placeholder(`${prefix}-${index * 2 + 1}`),
      away: placeholder(`${prefix}-${index * 2 + 2}`)
    }))
  );
}

function placeholder(label: string): BracketEntrant {
  return { label, sourceSlot: label };
}

function kickoffLabelForMatchNumber(
  matchNumber: number,
  knockoutScheduleByNumber: ReadonlyMap<number, string>
): Pick<BracketMatch, "kickoffLabel"> {
  const kickoffLabel = knockoutScheduleByNumber.get(matchNumber);

  return kickoffLabel ? { kickoffLabel } : {};
}

function knockoutScheduleByNumberForMatches(
  matches: readonly WorldCupMatch[],
  timeZone: string
): Map<number, string> {
  const schedule = new Map<number, string>();

  for (const match of matches) {
    if (match.phase === "group" || !match.kickoffAtUtc) {
      continue;
    }

    schedule.set(match.matchNumber, formatKickoffLabel(match.kickoffAtUtc, timeZone));
  }

  return schedule;
}

function formatKickoffLabel(kickoffAtUtc: string, timeZone: string): string {
  const date = new Date(kickoffAtUtc);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZoneName: "shortOffset"
  }).formatToParts(date);

  return `${part(parts, "day")}/${part(parts, "month")} ${part(parts, "hour")}:${part(
    parts,
    "minute"
  )} ${normalizeGmtOffset(part(parts, "timeZoneName"))}`;
}

function normalizeGmtOffset(value: string): string {
  return value.replace(/GMT([+-])0(\d)(?::00)?$/u, "GMT$1$2");
}

function part(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes
): string {
  return parts.find((candidate) => candidate.type === type)?.value ?? "";
}

function isManualTiebreakerError(error: unknown): boolean {
  return errorMessage(error).toLowerCase().includes("manual tiebreaker");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
