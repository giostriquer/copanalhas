import type { StoredPrediction } from "../storage/database.js";
import { isMatchOnMatchday, defaultMatchdayRolloverTime } from "../worldcup/matchday.js";
import { formatTeamName } from "../worldcup/team-display.js";
import type { WorldCupMatch } from "../worldcup/types.js";
import { formatPredictionScoreLabel } from "./display.js";

export interface FormatUserPredictionSummaryOptions {
  userId: string;
  date: string;
  matches: readonly WorldCupMatch[];
  predictions: readonly StoredPrediction[];
  timeZone?: string;
  matchdayRolloverTime?: string;
}

export function formatUserPredictionSummary(
  options: FormatUserPredictionSummaryOptions
): string {
  const matchesForDate = options.matches
    .filter((match) => {
      if (!options.timeZone) {
        return match.localDate === options.date;
      }

      return isMatchOnMatchday(
        match,
        options.date,
        options.timeZone,
        options.matchdayRolloverTime ?? defaultMatchdayRolloverTime
      );
    })
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
        ? formatPredictionScoreLabel(prediction)
        : "sem palpite";

      return `#${match.matchNumber} ${formatTeamName(match.homeTeam)} x ${formatTeamName(
        match.awayTeam
      )}: ${score}`;
    })
  ].join("\n");
}
