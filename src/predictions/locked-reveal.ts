import type { StoredPrediction } from "../storage/database.js";
import { scoreMatch, type MatchResult } from "../scoring/scoring.js";
import { formatTeamName } from "../worldcup/team-display.js";
import type { WorldCupMatch } from "../worldcup/types.js";

export interface LockedPredictionRevealBatchOptions {
  matches: readonly WorldCupMatch[];
  predictions: readonly StoredPrediction[];
}

export interface PredictionResultRevealBatchOptions extends LockedPredictionRevealBatchOptions {
  results: readonly MatchResult[];
}

export function formatLockedPredictionRevealBatch(
  options: LockedPredictionRevealBatchOptions
): string {
  return [
    "Palpites encerrados",
    "",
    ...options.matches.flatMap((match, index) => {
      const predictions = predictionsForMatch(options.predictions, match.id);

      return [
        ...(index === 0 ? [] : [""]),
        `#${match.matchNumber} ${formatTeamName(match.homeTeam)} x ${formatTeamName(
          match.awayTeam
        )}`,
        countLabel(predictions.length),
        ...formatLockedPredictionLines(match, predictions)
      ];
    })
  ].join("\n");
}

export function formatPredictionResultRevealBatch(
  options: PredictionResultRevealBatchOptions
): string {
  const resultsByMatchId = new Map(options.results.map((result) => [result.matchId, result]));

  return [
    "Resultado",
    "",
    ...options.matches.flatMap((match, index) => {
      const predictions = predictionsForMatch(options.predictions, match.id);
      const result = resultsByMatchId.get(match.id);

      if (!result) {
        return [];
      }

      const scoredByUserId = new Map(
        scoreMatch(result, predictions).map((scored) => [scored.userId, scored])
      );

      return [
        ...(index === 0 ? [] : [""]),
        `#${match.matchNumber} ${formatTeamName(match.homeTeam)} (${result.homeScore}) x (${
          result.awayScore
        }) ${formatTeamName(match.awayTeam)}`,
        countLabel(predictions.length),
        ...formatPredictionResultLines(predictions, scoredByUserId)
      ];
    })
  ].join("\n");
}

function predictionsForMatch(
  predictions: readonly StoredPrediction[],
  matchId: string
): StoredPrediction[] {
  return predictions
    .filter((prediction) => prediction.matchId === matchId)
    .toSorted(comparePredictionsForReveal);
}

function comparePredictionsForReveal(left: StoredPrediction, right: StoredPrediction): number {
  const byHomeScore = right.homeScore - left.homeScore;

  if (byHomeScore !== 0) {
    return byHomeScore;
  }

  const byAwayScore = right.awayScore - left.awayScore;

  if (byAwayScore !== 0) {
    return byAwayScore;
  }

  const bySubmittedAt = left.submittedAt.localeCompare(right.submittedAt);

  return bySubmittedAt === 0 ? left.userId.localeCompare(right.userId) : bySubmittedAt;
}

function formatLockedPredictionLines(
  match: WorldCupMatch,
  predictions: readonly StoredPrediction[]
): string[] {
  if (predictions.length === 0) {
    return ["Nenhum palpite enviado."];
  }

  const outcomeSections = (["home", "away", "draw"] as const)
    .map((outcome) => ({
      outcome,
      predictions: predictions.filter((prediction) => predictionOutcome(prediction) === outcome)
    }))
    .filter((section) => section.predictions.length > 0);

  return [
    "",
    ...outcomeSections.flatMap((section, index) => [
      ...(index === 0 ? [] : [""]),
      outcomeHeading(match, section.outcome),
      ...formatOutcomePredictionLines(section.predictions)
    ])
  ];
}

function formatOutcomePredictionLines(predictions: readonly StoredPrediction[]): string[] {
  const groups = scoreGroups(predictions);
  const sharedGroups = groups.filter((group) => group.length > 1);
  const soloGroups = groups.filter((group) => group.length === 1);
  const shouldCallOutSolo = sharedGroups.length > 0 && soloGroups.length > 0;

  if (!shouldCallOutSolo) {
    return groups.flatMap(formatPredictionGroup);
  }

  return [
    ...sharedGroups.flatMap(formatPredictionGroup),
    "------ Solo",
    ...soloGroups.flatMap(formatPredictionGroup)
  ];
}

function scoreGroups(predictions: readonly StoredPrediction[]): StoredPrediction[][] {
  const groups = new Map<string, StoredPrediction[]>();

  for (const prediction of predictions) {
    const key = `${prediction.homeScore}:${prediction.awayScore}`;
    const group = groups.get(key) ?? [];

    group.push(prediction);
    groups.set(key, group);
  }

  return [...groups.values()].toSorted((left, right) =>
    comparePredictionsForReveal(left[0] as StoredPrediction, right[0] as StoredPrediction)
  );
}

function formatPredictionGroup(predictions: readonly StoredPrediction[]): string[] {
  return predictions.map(
    (prediction) => `<@${prediction.userId}>  ${prediction.homeScore}x${prediction.awayScore}`
  );
}

function outcomeHeading(match: WorldCupMatch, outcome: PredictionOutcome): string {
  if (outcome === "home") {
    return `==== ${formatTeamName(match.homeTeam)} ====`;
  }

  if (outcome === "away") {
    return `==== ${formatTeamName(match.awayTeam)} ====`;
  }

  return "==== Empate ====";
}

function predictionOutcome(prediction: StoredPrediction): PredictionOutcome {
  if (prediction.homeScore > prediction.awayScore) {
    return "home";
  }

  if (prediction.homeScore < prediction.awayScore) {
    return "away";
  }

  return "draw";
}

function formatPredictionResultLines(
  predictions: readonly StoredPrediction[],
  scoredByUserId: ReadonlyMap<string, { points: number }>
): string[] {
  if (predictions.length === 0) {
    return ["Nenhum palpite enviado."];
  }

  return predictions.map((prediction) => {
    const points = scoredByUserId.get(prediction.userId)?.points ?? 0;

    return `<@${prediction.userId}>  ${prediction.homeScore}x${
      prediction.awayScore
    } - ${pointsLabel(points)}`;
  });
}

function countLabel(value: number): string {
  return `${value} ${value === 1 ? "palpite" : "palpites"}`;
}

function pointsLabel(value: number): string {
  return `${value} ${value === 1 ? "pt" : "pts"}`;
}

type PredictionOutcome = "home" | "away" | "draw";
