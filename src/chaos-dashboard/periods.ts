import type { MatchResult, ScorePrediction } from "../scoring/scoring.js";
import type { WorldCupMatch } from "../worldcup/types.js";

export type ChaosRecapPeriodKey =
  | "group-week-1"
  | "group-week-2"
  | "group-week-3"
  | "round-of-32"
  | "round-of-16"
  | "quarter-finals"
  | "semi-finals"
  | "finals";

export interface ChaosRecapPeriod {
  key: ChaosRecapPeriodKey;
  label: string;
  matchNumberStart: number;
  matchNumberEnd: number;
}

const groupStagePeriods = [
  {
    key: "group-week-1",
    label: "Fase de grupos - semana 1",
    matchNumberStart: 1,
    matchNumberEnd: 24
  },
  {
    key: "group-week-2",
    label: "Fase de grupos - semana 2",
    matchNumberStart: 25,
    matchNumberEnd: 48
  },
  {
    key: "group-week-3",
    label: "Fase de grupos - semana 3",
    matchNumberStart: 49,
    matchNumberEnd: 72
  }
] as const satisfies readonly ChaosRecapPeriod[];

export const chaosRecapPeriodChoices = groupStagePeriods.map((period) => ({
  key: period.key,
  label: period.label
})) satisfies Array<{ key: ChaosRecapPeriodKey; label: string }>;

export function listChaosRecapPeriods(matches: readonly WorldCupMatch[]): ChaosRecapPeriod[] {
  return groupStagePeriods.filter(
    (period) => matchesForChaosRecapPeriod(period, matches).length > 0
  );
}

export function parseChaosRecapPeriodKey(value: string | undefined): ChaosRecapPeriodKey | undefined {
  return chaosRecapPeriodChoices.find((period) => period.key === value)?.key;
}

export function matchesForChaosRecapPeriod(
  period: ChaosRecapPeriod,
  matches: readonly WorldCupMatch[]
): WorldCupMatch[] {
  return matches
    .filter(
      (match) =>
        match.matchNumber >= period.matchNumberStart && match.matchNumber <= period.matchNumberEnd
    )
    .toSorted((left, right) => left.matchNumber - right.matchNumber);
}

export function completedChaosRecapPeriods(
  periods: readonly ChaosRecapPeriod[],
  results: readonly MatchResult[],
  matches: readonly WorldCupMatch[] = []
): ChaosRecapPeriod[] {
  const resultMatchIds = new Set(results.map((result) => result.matchId));

  return periods.filter((period) => {
    const periodMatches =
      matches.length > 0 ? matchesForChaosRecapPeriod(period, matches) : matchesFromPeriod(period);

    return (
      periodMatches.length > 0 && periodMatches.every((match) => resultMatchIds.has(match.id))
    );
  });
}

export function filterPredictionsForChaosRecapPeriod(
  period: ChaosRecapPeriod,
  matches: readonly WorldCupMatch[],
  predictions: readonly ScorePrediction[]
): ScorePrediction[] {
  const matchIds = new Set(matchesForChaosRecapPeriod(period, matches).map((match) => match.id));

  return predictions.filter((prediction) => matchIds.has(prediction.matchId));
}

export function filterResultsForChaosRecapPeriod(
  period: ChaosRecapPeriod,
  matches: readonly WorldCupMatch[],
  results: readonly MatchResult[]
): MatchResult[] {
  const matchIds = new Set(matchesForChaosRecapPeriod(period, matches).map((match) => match.id));

  return results.filter((result) => matchIds.has(result.matchId));
}

function matchesFromPeriod(period: ChaosRecapPeriod): Array<{ id: string }> {
  return Array.from(
    { length: period.matchNumberEnd - period.matchNumberStart + 1 },
    (_value, index) => ({
      id: `wc2026-${(period.matchNumberStart + index).toString().padStart(3, "0")}`
    })
  );
}
