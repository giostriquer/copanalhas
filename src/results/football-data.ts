export interface FootballDataMatch {
  externalMatchId: string;
  kickoffAtUtc: string;
  status: string;
  fullTime: {
    homeScore: number;
    awayScore: number;
  } | null;
}

export interface FetchFootballDataMatchesOptions {
  token: string;
  dateFrom: string;
  dateTo: string;
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
  const fullTime = match.score?.fullTime;
  const homeScore = fullTime?.homeTeam;
  const awayScore = fullTime?.awayTeam;
  const hasFullTimeScore = typeof homeScore === "number" && typeof awayScore === "number";

  return {
    externalMatchId: String(match.id),
    kickoffAtUtc: new Date(assertString(match.utcDate, "utcDate")).toISOString(),
    status: assertString(match.status, "status"),
    fullTime: hasFullTimeScore
      ? {
          homeScore,
          awayScore
        }
      : null
  };
}

export async function fetchFootballDataMatches(
  options: FetchFootballDataMatchesOptions
): Promise<FootballDataFetchResult> {
  const fetch = options.fetch ?? globalThis.fetch;
  const url = new URL("https://api.football-data.org/v4/competitions/WC/matches");
  url.searchParams.set("dateFrom", options.dateFrom);
  url.searchParams.set("dateTo", options.dateTo);

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
    fullTime?: {
      homeTeam: number | null;
      awayTeam: number | null;
    };
  };
}

function assertString(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new Error(`football-data match ${fieldName} must be a string`);
  }

  return value;
}
