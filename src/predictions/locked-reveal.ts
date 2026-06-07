import type { StoredPrediction } from "../storage/database.js";
import { formatTeamName } from "../worldcup/team-display.js";
import type { WorldCupMatch } from "../worldcup/types.js";

export interface LockedPredictionRevealBatchOptions {
  matches: readonly WorldCupMatch[];
  predictions: readonly StoredPrediction[];
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

function countLabel(value: number): string {
  return `${value} ${value === 1 ? "palpite" : "palpites"}`;
}
