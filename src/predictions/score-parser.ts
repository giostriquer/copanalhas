export interface ParsedScoreInput {
  homeScore: number;
  awayScore: number;
  normalizedText: string;
}

export type ScoreInputParseResult =
  | { ok: true; score: ParsedScoreInput }
  | { ok: false; reason: "invalid-score-format" };

const scorePattern = /^(?<homeScore>\d{1,2})\s*(?:x|-)\s*(?<awayScore>\d{1,2})$/iu;

export function parseScoreInput(input: string): ScoreInputParseResult {
  const match = scorePattern.exec(input.trim());

  if (!match?.groups?.homeScore || !match.groups.awayScore) {
    return { ok: false, reason: "invalid-score-format" };
  }

  const homeScore = Number.parseInt(match.groups.homeScore, 10);
  const awayScore = Number.parseInt(match.groups.awayScore, 10);

  return {
    ok: true,
    score: {
      homeScore,
      awayScore,
      normalizedText: `${homeScore}-${awayScore}`
    }
  };
}
