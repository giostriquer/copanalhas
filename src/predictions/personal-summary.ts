import type { StoredPrediction } from "../storage/database.js";
import { formatTeamName } from "../worldcup/team-display.js";
import type { WorldCupMatch } from "../worldcup/types.js";

export interface FormatUserPredictionSummaryOptions {
  userId: string;
  date: string;
  matches: readonly WorldCupMatch[];
  predictions: readonly StoredPrediction[];
}

export function formatUserPredictionSummary(
  options: FormatUserPredictionSummaryOptions
): string {
  const matchesForDate = options.matches
    .filter((match) => match.localDate === options.date)
    .toSorted((left, right) => left.matchNumber - right.matchNumber);

  if (matchesForDate.length === 0) {
    return `Nenhum jogo encontrado para ${options.date}.`;
  }

  const predictionsByMatch = new Map(
    options.predictions
      .filter((prediction) => prediction.userId === options.userId)
      .map((prediction) => [prediction.matchId, prediction])
  );

  return [
    `Meus palpites - ${options.date}`,
    ...matchesForDate.map((match) => {
      const prediction = predictionsByMatch.get(match.id);
      const score = prediction
        ? `${prediction.homeScore}x${prediction.awayScore}`
        : "sem palpite";

      return `#${match.matchNumber} ${formatTeamName(match.homeTeam)} x ${formatTeamName(
        match.awayTeam
      )}: ${score}`;
    })
  ].join("\n");
}
