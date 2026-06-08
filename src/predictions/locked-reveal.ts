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
        ...formatPredictionLines(predictions)
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
    .toSorted((left, right) => {
      const bySubmittedAt = left.submittedAt.localeCompare(right.submittedAt);

      return bySubmittedAt === 0 ? left.userId.localeCompare(right.userId) : bySubmittedAt;
    });
}

function formatPredictionLines(predictions: readonly StoredPrediction[]): string[] {
  if (predictions.length === 0) {
    return ["Nenhum palpite enviado."];
  }

  return predictions.map(
    (prediction) => `<@${prediction.userId}>  ${prediction.homeScore}x${prediction.awayScore}`
  );
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
