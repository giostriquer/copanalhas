import type { StoredPrediction } from "../storage/database.js";
import {
  canSubmitPredictionAt,
  formatDiscordInstant,
  formatDiscordTimestamp
} from "../worldcup/cutoff.js";
import { formatTeamName } from "../worldcup/team-display.js";
import type { WorldCupMatch } from "../worldcup/types.js";

export interface PredictionVisibilityOptions {
  match: WorldCupMatch;
  predictions: StoredPrediction[];
  now: Date;
}

export interface PredictionReveal {
  ok: boolean;
  content: string;
}

export function formatPredictionAudit(options: PredictionVisibilityOptions): string {
  const matchingPredictions = predictionsForMatch(options.predictions, options.match.id);

  return [
    "Prediction Audit",
    matchLabel(options.match),
    formatWindowStatus(options.match, options.now),
    "",
    formatSubmittedPredictions(matchingPredictions, "audit")
  ].join("\n");
}

export function formatPredictionReveal(options: PredictionVisibilityOptions): PredictionReveal {
  const submissionWindow = canSubmitPredictionAt(options.match, options.now);

  if (submissionWindow.ok) {
    return {
      ok: false,
      content: [
        `Predictions are still open for ${matchLabel(options.match)}.`,
        `Public reveal unlocks when predictions close: ${formatDiscordInstant(
          submissionWindow.closesAtUtc
        )}.`
      ].join("\n")
    };
  }

  if (submissionWindow.reason === "missing-kickoff") {
    return {
      ok: false,
      content: [
        `Public reveal is not available for ${matchLabel(options.match)} yet.`,
        "The match kickoff time is not verified, so there is no prediction lock time."
      ].join("\n")
    };
  }

  return {
    ok: true,
    content: [
      `Picks are locked for Match #${options.match.matchNumber}`,
      `${formatTeamName(options.match.homeTeam)} vs ${formatTeamName(options.match.awayTeam)}`,
      "",
      formatSubmittedPredictions(predictionsForMatch(options.predictions, options.match.id), "reveal")
    ].join("\n")
  };
}

function formatWindowStatus(match: WorldCupMatch, now: Date): string {
  const submissionWindow = canSubmitPredictionAt(match, now);

  if (submissionWindow.ok) {
    return `Window: open, closes ${formatDiscordTimestamp(submissionWindow.closesAtUtc, "R")}`;
  }

  if (submissionWindow.reason === "missing-kickoff") {
    return "Window: closed, kickoff not verified";
  }

  return `Window: closed since ${formatDiscordTimestamp(submissionWindow.closesAtUtc, "R")}`;
}

function formatSubmittedPredictions(
  predictions: StoredPrediction[],
  mode: "audit" | "reveal"
): string {
  if (predictions.length === 0) {
    return "No predictions yet.";
  }

  return [
    `${predictions.length} submitted`,
    ...predictions.map((prediction) =>
      mode === "audit"
        ? `${userLabel(prediction.userId)}  ${scoreLabel(prediction)}  submitted ${formatDiscordTimestamp(
            prediction.submittedAt,
            "R"
          )}`
        : `${userLabel(prediction.userId)}  ${scoreLabel(prediction)}`
    )
  ].join("\n");
}

function predictionsForMatch(predictions: StoredPrediction[], matchId: string): StoredPrediction[] {
  return predictions
    .filter((prediction) => prediction.matchId === matchId)
    .toSorted((left, right) => {
      const bySubmittedAt = left.submittedAt.localeCompare(right.submittedAt);

      return bySubmittedAt === 0 ? left.userId.localeCompare(right.userId) : bySubmittedAt;
    });
}

function matchLabel(match: WorldCupMatch): string {
  return `Match #${match.matchNumber} - ${formatTeamName(match.homeTeam)} vs ${formatTeamName(
    match.awayTeam
  )}`;
}

function scoreLabel(prediction: Pick<StoredPrediction, "homeScore" | "awayScore">): string {
  return `${prediction.homeScore}x${prediction.awayScore}`;
}

function userLabel(userId: string): string {
  return `<@${userId}>`;
}
