import { describe, expect, test, vi } from "vitest";

import {
  fetchFootballDataMatches,
  parseFootballDataMatch,
  type FootballDataFetch
} from "./football-data.js";

describe("parseFootballDataMatch", () => {
  test("parses v4 finished full-time scores", () => {
    expect(
      parseFootballDataMatch({
        id: 12345,
        utcDate: "2026-06-11T19:00:00Z",
        status: "FINISHED",
        score: {
          fullTime: {
            home: 2,
            away: 1
          }
        }
      })
    ).toEqual({
      externalMatchId: "12345",
      kickoffAtUtc: "2026-06-11T19:00:00.000Z",
      status: "FINISHED",
      fullTime: {
        homeScore: 2,
        awayScore: 1
      }
    });
  });

  test("parses legacy homeTeam and awayTeam full-time scores", () => {
    expect(
      parseFootballDataMatch({
        id: 12345,
        utcDate: "2026-06-11T19:00:00Z",
        status: "FINISHED",
        score: {
          fullTime: {
            homeTeam: 2,
            awayTeam: 1
          }
        }
      }).fullTime
    ).toEqual({
      homeScore: 2,
      awayScore: 1
    });
  });

  test("keeps unfinished scores empty", () => {
    expect(
      parseFootballDataMatch({
        id: 12345,
        utcDate: "2026-06-11T19:00:00Z",
        status: "SCHEDULED",
        score: {
          fullTime: {
            homeTeam: null,
            awayTeam: null
          }
        }
      }).fullTime
    ).toBeNull();
  });

  test("parses extra-time score layers as final score after extra time", () => {
    expect(
      parseFootballDataMatch({
        id: 12345,
        utcDate: "2026-07-05T21:00:00Z",
        status: "FINISHED",
        score: {
          winner: "HOME_TEAM",
          duration: "EXTRA_TIME",
          fullTime: {
            home: 2,
            away: 1
          },
          regularTime: {
            home: 1,
            away: 1
          },
          extraTime: {
            home: 1,
            away: 0
          }
        }
      })
    ).toMatchObject({
      externalMatchId: "12345",
      status: "FINISHED",
      fullTime: {
        homeScore: 2,
        awayScore: 1
      },
      decisionMethod: "extra_time",
      regularTime: {
        homeScore: 1,
        awayScore: 1
      },
      extraTime: {
        homeScore: 2,
        awayScore: 1
      },
      winner: "home"
    });
  });

  test("parses penalty shootout score layers", () => {
    expect(
      parseFootballDataMatch({
        id: 12345,
        utcDate: "2026-07-05T21:00:00Z",
        status: "FINISHED",
        score: {
          winner: "HOME_TEAM",
          duration: "PENALTY_SHOOTOUT",
          fullTime: {
            home: 6,
            away: 5
          },
          regularTime: {
            home: 1,
            away: 1
          },
          extraTime: {
            home: 0,
            away: 0
          },
          penalties: {
            home: 5,
            away: 4
          }
        }
      })
    ).toMatchObject({
      externalMatchId: "12345",
      status: "FINISHED",
      fullTime: {
        homeScore: 6,
        awayScore: 5
      },
      decisionMethod: "penalties",
      regularTime: {
        homeScore: 1,
        awayScore: 1
      },
      extraTime: {
        homeScore: 1,
        awayScore: 1
      },
      penalties: {
        homeScore: 5,
        awayScore: 4
      },
      winner: "home"
    });
  });
});

describe("fetchFootballDataMatches", () => {
  test("fetches World Cup matches with date filters and auth header", async () => {
    const fetch = vi.fn<FootballDataFetch>(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        matches: [
          {
            id: 12345,
            utcDate: "2026-06-11T19:00:00Z",
            status: "FINISHED",
            score: {
              fullTime: {
                homeTeam: 2,
                awayTeam: 1
              }
            }
          }
        ]
      })
    }));

    const result = await fetchFootballDataMatches({
      token: "football-data-token",
      dateFrom: "2026-06-11",
      dateTo: "2026-06-12",
      fetch
    });

    expect(result).toEqual({
      ok: true,
      matches: [
        {
          externalMatchId: "12345",
          kickoffAtUtc: "2026-06-11T19:00:00.000Z",
          status: "FINISHED",
          fullTime: {
            homeScore: 2,
            awayScore: 1
          }
        }
      ]
    });

    const [url, init] = fetch.mock.calls[0] ?? [];
    const requestedUrl = new URL(String(url));

    expect(requestedUrl.href).toBe(
      "https://api.football-data.org/v4/competitions/WC/matches?dateFrom=2026-06-11&dateTo=2026-06-12"
    );
    expect(init).toEqual({
      method: "GET",
      headers: {
        "X-Auth-Token": "football-data-token"
      }
    });
  });

  test("fetches specific matches by provider ids when supplied", async () => {
    const fetch = vi.fn<FootballDataFetch>(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ matches: [] })
    }));

    await fetchFootballDataMatches({
      token: "football-data-token",
      dateFrom: "2026-06-11",
      dateTo: "2026-06-11",
      externalMatchIds: ["537327", "537328"],
      fetch
    });

    const [url] = fetch.mock.calls[0] ?? [];
    const requestedUrl = new URL(String(url));

    expect(requestedUrl.origin + requestedUrl.pathname).toBe(
      "https://api.football-data.org/v4/matches"
    );
    expect(requestedUrl.searchParams.get("ids")).toBe("537327,537328");
    expect(requestedUrl.searchParams.has("dateFrom")).toBe(false);
    expect(requestedUrl.searchParams.has("dateTo")).toBe(false);
  });

  test("keeps competition dateTo filters literal", async () => {
    const fetch = vi.fn<FootballDataFetch>(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ matches: [] })
    }));

    await fetchFootballDataMatches({
      token: "football-data-token",
      dateFrom: "2026-06-11",
      dateTo: "2026-06-11",
      fetch
    });

    const [url] = fetch.mock.calls[0] ?? [];
    const requestedUrl = new URL(String(url));

    expect(requestedUrl.href).toBe(
      "https://api.football-data.org/v4/competitions/WC/matches?dateFrom=2026-06-11&dateTo=2026-06-11"
    );
  });

  test("returns rate-limited for HTTP 429", async () => {
    const fetch = vi.fn<FootballDataFetch>(async () => ({
      ok: false,
      status: 429,
      json: async () => ({})
    }));

    await expect(
      fetchFootballDataMatches({
        token: "football-data-token",
        dateFrom: "2026-06-11",
        dateTo: "2026-06-12",
        fetch
      })
    ).resolves.toEqual({ ok: false, reason: "rate-limited" });
  });
});
