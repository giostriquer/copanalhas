import type { StandingsResult } from "../standings/standings.js";
import {
  computeFifaGroupStandings,
  rankThirdPlacedRows,
  type FifaGroupStandingRow,
  type FifaQualificationStatus
} from "../worldcup/fifa-qualification.js";
import type { WorldCupMatch } from "../worldcup/types.js";

export type ThirdPlaceQualificationState = "advancing" | "cutoff" | "outside";

export interface ThirdPlaceStandingRow extends FifaGroupStandingRow {
  thirdPlaceRank: number;
  qualificationState: ThirdPlaceQualificationState;
}

export interface ThirdPlaceStandings {
  status: FifaQualificationStatus;
  rows: ThirdPlaceStandingRow[];
}

export function computeThirdPlaceStandings(
  matches: readonly WorldCupMatch[],
  results: readonly StandingsResult[]
): ThirdPlaceStandings {
  const thirdPlacedRows = computeFifaGroupStandings(matches, results)
    .map((standing) => standing.rows[2])
    .filter((row): row is FifaGroupStandingRow => row !== undefined);
  const ranking = rankThirdPlacedRows(thirdPlacedRows);
  const cutoffScore =
    ranking.status === "needs-manual-tiebreaker" &&
    ranking.rows[7] !== undefined &&
    ranking.rows[8] !== undefined
      ? scoreForRow(ranking.rows[7])
      : null;

  return {
    status: ranking.status,
    rows: ranking.rows.map((row, index) => ({
      ...row,
      thirdPlaceRank: index + 1,
      qualificationState: qualificationStateForRank(index, cutoffScore, row)
    }))
  };
}

function qualificationStateForRank(
  index: number,
  cutoffScore: ThirdPlaceScore | null,
  row: FifaGroupStandingRow
): ThirdPlaceQualificationState {
  if (cutoffScore && sameScore(cutoffScore, scoreForRow(row))) {
    return "cutoff";
  }

  return index < 8 ? "advancing" : "outside";
}

interface ThirdPlaceScore {
  points: number;
  goalDifference: number;
  goalsFor: number;
}

function scoreForRow(row: FifaGroupStandingRow): ThirdPlaceScore {
  return {
    points: row.points,
    goalDifference: row.goalDifference,
    goalsFor: row.goalsFor
  };
}

function sameScore(left: ThirdPlaceScore, right: ThirdPlaceScore): boolean {
  return (
    left.points === right.points &&
    left.goalDifference === right.goalDifference &&
    left.goalsFor === right.goalsFor
  );
}
