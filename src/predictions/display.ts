import type { StoredPrediction } from "../storage/database.js";

type PredictionScoreDisplay = Pick<
  StoredPrediction,
  "homeScore" | "awayScore" | "decisionMethod"
>;

export function formatPredictionScoreLabel(
  prediction: PredictionScoreDisplay,
  options: { separator?: "x" | "-"; includeDecision?: boolean } = {}
): string {
  const separator = options.separator ?? "x";
  const score = `${prediction.homeScore}${separator}${prediction.awayScore}`;

  if (options.includeDecision === false || !prediction.decisionMethod) {
    return score;
  }

  return `${score} (${formatDecisionMethodLabel(prediction.decisionMethod)})`;
}

export function formatDecisionMethodLabel(
  value: NonNullable<StoredPrediction["decisionMethod"]>
): string {
  if (value === "regular") {
    return "Tempo regulamentar";
  }

  if (value === "extra_time") {
    return "Prorrogação";
  }

  return "Pênaltis";
}
