export type PredictionParseFailureReason =
  | "unsupported-format"
  | "same-team";

export interface ParsedPrediction {
  matchNumber: number | undefined;
  homeTeamCode: string;
  awayTeamCode: string;
  homeScore: number;
  awayScore: number;
  normalizedText: string;
}

export type PredictionParseResult =
  | { ok: true; prediction: ParsedPrediction }
  | { ok: false; reason: PredictionParseFailureReason };

const predictionPattern =
  /^(?:#(?<matchNumber>\d{1,3})\s+)?(?<homeTeamCode>[a-z]{2,4})\s+(?<homeScore>\d{1,2})\s*(?:-|x)\s*(?<awayScore>\d{1,2})\s+(?<awayTeamCode>[a-z]{2,4})$/iu;

export function parsePredictionMessage(content: string): PredictionParseResult {
  const trimmed = content.trim();
  const match = predictionPattern.exec(trimmed);

  if (!match?.groups) {
    return { ok: false, reason: "unsupported-format" };
  }

  const {
    matchNumber: rawMatchNumber,
    homeTeamCode: rawHomeTeamCode,
    homeScore: rawHomeScore,
    awayScore: rawAwayScore,
    awayTeamCode: rawAwayTeamCode
  } = match.groups;

  if (!rawHomeTeamCode || !rawHomeScore || !rawAwayScore || !rawAwayTeamCode) {
    return { ok: false, reason: "unsupported-format" };
  }

  const homeTeamCode = rawHomeTeamCode.toUpperCase();
  const awayTeamCode = rawAwayTeamCode.toUpperCase();

  if (homeTeamCode === awayTeamCode) {
    return { ok: false, reason: "same-team" };
  }

  const homeScore = Number.parseInt(rawHomeScore, 10);
  const awayScore = Number.parseInt(rawAwayScore, 10);
  const matchNumber = rawMatchNumber
    ? Number.parseInt(rawMatchNumber, 10)
    : undefined;

  return {
    ok: true,
    prediction: {
      matchNumber,
      homeTeamCode,
      awayTeamCode,
      homeScore,
      awayScore,
      normalizedText: `${matchNumber === undefined ? "" : `#${matchNumber} `}${homeTeamCode} ${homeScore}-${awayScore} ${awayTeamCode}`
    }
  };
}
