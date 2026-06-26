import type { DecisionMethod, MatchWinner } from "../scoring/scoring.js";

interface FootballDataScoreLayer {
  homeScore: number;
  awayScore: number;
}

export interface FootballDataMatch {
  externalMatchId: string;
  kickoffAtUtc: string;
  status: string;
  fullTime: FootballDataScoreLayer | null;
  decisionMethod?: DecisionMethod;
  regularTime?: FootballDataScoreLayer | null;
  extraTime?: FootballDataScoreLayer | null;
  penalties?: FootballDataScoreLayer | null;
  winner?: MatchWinner;
}

export interface FetchFootballDataMatchesOptions {
  token: string;
  dateFrom: string;
  dateTo: string;
  externalMatchIds?: readonly string[];
  fetch?: FootballDataFetch;
}

export type FootballDataFetchResult =
  | { ok: true; matches: FootballDataMatch[] }
  | { ok: false; reason: "rate-limited" | "unavailable" };

export type FootballDataFetch = (
  url: string,
  init: {
    method: "GET";
    headers: {
      "X-Auth-Token": string;
    };
  }
) => Promise<FootballDataResponse>;

export interface FootballDataResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

export function parseFootballDataMatch(input: unknown): FootballDataMatch {
  const match = input as FootballDataRawMatch;
  const fullTime = readScore(match.score?.fullTime);
  const regularTime = readScore(match.score?.regularTime);
  const extraTimeGoals = readScore(match.score?.extraTime);
  const extraTime = regularTime && extraTimeGoals ? addScores(regularTime, extraTimeGoals) : extraTimeGoals;
  const penalties = readScore(match.score?.penalties);
  const decisionMethod = decisionMethodFromDuration(match.score?.duration);
  const winner = winnerFromProvider(match.score?.winner);

  return {
    externalMatchId: String(match.id),
    kickoffAtUtc: new Date(assertString(match.utcDate, "utcDate")).toISOString(),
    status: assertString(match.status, "status"),
    fullTime,
    ...(decisionMethod ? { decisionMethod } : {}),
    ...(regularTime ? { regularTime } : {}),
    ...(extraTime ? { extraTime } : {}),
    ...(penalties ? { penalties } : {}),
    ...(winner ? { winner } : {})
  };
}

export async function fetchFootballDataMatches(
  options: FetchFootballDataMatchesOptions
): Promise<FootballDataFetchResult> {
  const fetch = options.fetch ?? globalThis.fetch;
  const url =
    options.externalMatchIds && options.externalMatchIds.length > 0
      ? new URL("https://api.football-data.org/v4/matches")
      : new URL("https://api.football-data.org/v4/competitions/WC/matches");

  if (options.externalMatchIds && options.externalMatchIds.length > 0) {
    url.searchParams.set("ids", options.externalMatchIds.join(","));
  } else {
    url.searchParams.set("dateFrom", options.dateFrom);
    url.searchParams.set("dateTo", options.dateTo);
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "X-Auth-Token": options.token
    }
  });

  if (response.status === 429) {
    return { ok: false, reason: "rate-limited" };
  }

  if (!response.ok) {
    return { ok: false, reason: "unavailable" };
  }

  const body = (await response.json()) as { matches?: unknown[] };

  return {
    ok: true,
    matches: Array.isArray(body.matches) ? body.matches.map(parseFootballDataMatch) : []
  };
}

interface FootballDataRawMatch {
  id: number | string;
  utcDate: unknown;
  status: unknown;
  score?: {
    winner?: unknown;
    duration?: unknown;
    fullTime?: FootballDataRawScore;
    regularTime?: FootballDataRawScore;
    extraTime?: FootballDataRawScore;
    penalties?: FootballDataRawScore;
  };
}

interface FootballDataRawScore {
  home?: number | null;
  away?: number | null;
  homeTeam?: number | null;
  awayTeam?: number | null;
}

function scoreValue(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function readScore(score: FootballDataRawScore | undefined | null): FootballDataScoreLayer | null {
  const homeScore = scoreValue(score?.home) ?? scoreValue(score?.homeTeam);
  const awayScore = scoreValue(score?.away) ?? scoreValue(score?.awayTeam);

  if (homeScore === undefined || awayScore === undefined) {
    return null;
  }

  return { homeScore, awayScore };
}

function addScores(
  first: FootballDataScoreLayer,
  second: FootballDataScoreLayer
): FootballDataScoreLayer {
  return {
    homeScore: first.homeScore + second.homeScore,
    awayScore: first.awayScore + second.awayScore
  };
}

function decisionMethodFromDuration(duration: unknown): DecisionMethod | undefined {
  if (duration === "REGULAR" || duration === "REGULAR_TIME") {
    return "regular";
  }

  if (duration === "EXTRA_TIME") {
    return "extra_time";
  }

  if (duration === "PENALTY_SHOOTOUT" || duration === "PENALTIES") {
    return "penalties";
  }

  return undefined;
}

function winnerFromProvider(winner: unknown): MatchWinner | undefined {
  if (winner === "HOME_TEAM") {
    return "home";
  }

  if (winner === "AWAY_TEAM") {
    return "away";
  }

  return undefined;
}

function assertString(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new Error(`football-data match ${fieldName} must be a string`);
  }

  return value;
}
