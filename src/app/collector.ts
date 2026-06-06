import type { DiscordIngestionResult } from "../discord/ingestion.js";
import type { StoredPrediction } from "../storage/database.js";
import type { WorldCupMatch } from "../worldcup/types.js";

export interface PredictionPersistenceHandlerOptions {
  matches: WorldCupMatch[];
  upsertPrediction(prediction: StoredPrediction): void | Promise<void>;
  refreshLeaderboardAfterPrediction?(): void | Promise<void>;
  writeLine(line: string): void;
}

export function createPredictionPersistenceHandler(
  options: PredictionPersistenceHandlerOptions
): (result: DiscordIngestionResult) => Promise<void> {
  const matchesByNumber = new Map(options.matches.map((match) => [match.matchNumber, match]));

  return async (result) => {
    if (result.action !== "accepted") {
      return;
    }

    const { prediction } = result;

    if (prediction.matchNumber === undefined) {
      options.writeLine(`Ignored prediction ${prediction.messageId}: missing match number`);
      return;
    }

    const match = matchesByNumber.get(prediction.matchNumber);

    if (!match) {
      options.writeLine(
        `Ignored prediction ${prediction.messageId}: unknown match number ${prediction.matchNumber}`
      );
      return;
    }

    await options.upsertPrediction({
      userId: prediction.userId,
      matchId: match.id,
      messageId: prediction.messageId,
      homeScore: prediction.homeScore,
      awayScore: prediction.awayScore,
      submittedAt: prediction.submittedAt,
      updatedAt: prediction.updatedAt,
      parserVersion: prediction.parserVersion
    });
    await options.refreshLeaderboardAfterPrediction?.();
  };
}
