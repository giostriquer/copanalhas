import { describe, expect, test, vi } from "vitest";
import { Buffer } from "node:buffer";

import { logUnhandledCliError, runCli, startNodeInterval } from "./index.js";
import type { CliDependencies, CliStore } from "./index.js";
import type { CopanalhasConfig } from "./discord/config.js";
import type { MatchCardMessage } from "./discord/components.js";
import { WORLD_CUP_2026_SEED } from "./worldcup/seed.js";
import { isGroupStageMatch } from "./worldcup/types.js";

describe("runCli", () => {
  test("prints a leaderboard from stored predictions and results", async () => {
    const lines: string[] = [];
    const store = createStore({
      listPredictions: () => [
        {
          userId: "u1",
          matchId: "wc2026-001",
          messageId: "m1",
          homeScore: 2,
          awayScore: 1,
          submittedAt: "2026-06-10T12:00:00.000Z",
          updatedAt: null,
          parserVersion: "prediction-parser-v1"
        },
        {
          userId: "u2",
          matchId: "wc2026-001",
          messageId: "m2",
          homeScore: 1,
          awayScore: 1,
          submittedAt: "2026-06-10T12:01:00.000Z",
          updatedAt: null,
          parserVersion: "prediction-parser-v1"
        }
      ],
      listResults: () => [
        {
          matchId: "wc2026-001",
          homeScore: 2,
          awayScore: 1,
          recordedAt: "2026-06-11T23:00:00.000Z",
          resultSource: "manual",
          externalMatchId: null,
          fetchedAt: null
        }
      ]
    });

    await runCli(["leaderboard"], {
      openDatabase: () => store,
      writeLine: (line) => lines.push(line),
      env: {},
      startDiscord: async () => undefined
    });

    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("Ranking Copanalhas");
    expect(lines[0]).toContain(
      "1. u1 - 5 pts (1 solo, 0 exatos, 0 resultados, 0 mais próximos, 0 bônus, 1 partida)"
    );
    expect(lines[0]).toContain(
      "2. u2 - 0 pts (0 solos, 0 exatos, 0 resultados, 0 mais próximos, 0 bônus, 1 partida)"
    );
    expect(lines[0]).toContain("Como funciona");
    expect(lines[0]).toContain("Se só uma pessoa acertar o placar exato, ela ganha 5 pts solo.");
  });

  test("seeds reviewed World Cup matches", async () => {
    const lines: string[] = [];
    const store = createStore();

    await runCli(["seed-matches"], {
      openDatabase: () => store,
      writeLine: (line) => lines.push(line),
      env: {},
      startDiscord: async () => undefined
    });

    expect(store.upsertMatches).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: "wc2026-001",
          matchNumber: 1
        })
      ])
    );
    expect(lines).toEqual(["Seeded 104 World Cup matches."]);
  });

  test("records a match result", async () => {
    const lines: string[] = [];
    const store = createStore();

    await runCli(["record-result", "wc2026-001", "2", "1"], {
      openDatabase: () => store,
      writeLine: (line) => lines.push(line),
      env: {},
      startDiscord: async () => undefined
    });

    expect(store.upsertResult).toHaveBeenCalledWith({
      matchId: "wc2026-001",
      homeScore: 2,
      awayScore: 1,
      recordedAt: expect.any(String),
      resultSource: "manual",
      externalMatchId: null,
      fetchedAt: null
    });
    expect(lines).toEqual(["Recorded result wc2026-001 2-1."]);
  });

  test("clears posted match card records for a selected date", async () => {
    const lines: string[] = [];
    const store = createStore({
      clearPostedMatchCardsForDate: vi.fn(() => 2)
    });

    await runCli(["clear-posted-date", "2026-06-11"], {
      openDatabase: () => store,
      writeLine: (line) => lines.push(line),
      env: {
        DISCORD_CHANNEL_ID: "channel-1",
        COPANALHAS_DATABASE_PATH: "./tmp/copanalhas.sqlite"
      },
      startDiscord: async () => undefined
    });

    expect(store.migrate).toHaveBeenCalledOnce();
    expect(store.clearPostedMatchCardsForDate).toHaveBeenCalledWith("channel-1", "2026-06-11");
    expect(store.close).toHaveBeenCalledOnce();
    expect(lines).toEqual([
      "Cleared 2 posted match card records for 2026-06-11. Predictions, results, and standings were not touched."
    ]);
  });

  test("requires a channel id before clearing posted match card records", async () => {
    const lines: string[] = [];

    await runCli(["clear-posted-date", "2026-06-11"], {
      openDatabase: () => {
        throw new Error("database should not open");
      },
      writeLine: (line) => lines.push(line),
      env: {},
      startDiscord: async () => undefined
    });

    expect(lines).toEqual(["DISCORD_CHANNEL_ID is required"]);
  });

  test("posts match cards for a selected World Cup date", async () => {
    const lines: string[] = [];
    const store = createStore();
    const postMatchCards = vi.fn(
      async (_config: CopanalhasConfig, _messages: MatchCardMessage[]) => undefined
    );

    await runCli(["post-matches-today", "2026-06-11"], {
      openDatabase: () => store,
      writeLine: (line) => lines.push(line),
      env: {
        DISCORD_BOT_TOKEN: "token-value",
        DISCORD_GUILD_ID: "guild-1",
        DISCORD_CHANNEL_ID: "channel-1"
      },
      startDiscord: async () => undefined,
      postMatchCards
    });

    expect(store.migrate).toHaveBeenCalledOnce();
    expect(store.close).toHaveBeenCalledOnce();
    expect(postMatchCards).toHaveBeenCalledWith(
      expect.objectContaining({
        discordToken: "token-value",
        guildId: "guild-1",
        channelId: "channel-1",
        databasePath: "./data/copanalhas.sqlite"
      }),
      [
        expect.objectContaining({
          content: "JOGOS DO DIA",
          embeds: expect.arrayContaining([expect.anything()]),
          components: expect.arrayContaining([expect.anything()])
        })
      ]
    );
    const postedMessages = vi.mocked(postMatchCards).mock.calls[0]?.[1];
    const postedMessage = postedMessages?.[0];

    if (!postedMessage) {
      throw new Error("expected a grouped matchday message");
    }

    const matchdayEmbed = postedMessage.embeds?.[0]?.toJSON();

    expect(matchdayEmbed).toMatchObject({
      title: "quinta-feira, 11 de junho de 2026",
      description: "Use os botões abaixo para enviar seu palpite."
    });
    expect(matchdayEmbed?.fields?.map((field) => field.value)).toEqual([
      expect.stringContaining("México x África do Sul"),
      expect.stringContaining("Coreia do Sul x Tchéquia")
    ]);
    expect(postedMessage.components[0]?.toJSON()).toMatchObject({
      components: [
        { custom_id: "copanalhas:predict:wc2026-001", label: "Palpite #1" },
        { custom_id: "copanalhas:predict:wc2026-002", label: "Palpite #2" }
      ]
    });
    expect(lines).toEqual(["Posted 1 matchday card for 2 matches on 2026-06-11."]);
  });

  test("posts resolved round-of-32 team names from stored group results", async () => {
    const lines: string[] = [];
    const store = createStore({
      listResults: () => currentSeedProofStoredResultsForGroups(["A", "B"])
    });
    const postMatchCards = vi.fn(
      async (_config: CopanalhasConfig, _messages: MatchCardMessage[]) => undefined
    );

    await runCli(["post-matches-today", "2026-06-28"], {
      openDatabase: () => store,
      writeLine: (line) => lines.push(line),
      env: {
        DISCORD_BOT_TOKEN: "token-value",
        DISCORD_GUILD_ID: "guild-1",
        DISCORD_CHANNEL_ID: "channel-1"
      },
      startDiscord: async () => undefined,
      postMatchCards
    });

    const postedMessage = vi.mocked(postMatchCards).mock.calls[0]?.[1]?.[0];
    const roundOf32Field = postedMessage?.embeds?.[0]
      ?.toJSON()
      .fields?.find((field) => field.name === "#73 · Rodada de 32");

    expect(roundOf32Field?.value).toContain("África do Sul x Bósnia e Herzegovina");
    expect(roundOf32Field?.value).not.toContain("2º Grupo A");
    expect(roundOf32Field?.value).not.toContain("2º Grupo B");
    expect(lines).toEqual(["Posted 1 matchday card for 1 matches on 2026-06-28."]);
  });

  test("prints a local standings preview with simulated first-day results", async () => {
    const lines: string[] = [];

    await runCli(["standings-preview"], {
      openDatabase: () => {
        throw new Error("database should not open");
      },
      writeLine: (line) => lines.push(line),
      env: {},
      startDiscord: async () => undefined
    });

    const output = lines.join("\n");

    expect(output).toContain("World Cup 2026 Group Standings");
    expect(output).toContain("Grupos A-F");
    expect(output).toContain("Grupos G-L");
    expect(output).toContain("| GROUP A                | GROUP B                | GROUP C                |");
    expect(output).toContain("México");
    expect(output).toContain("Bósnia e Herz.");
    expect(output).toContain("Brasil");
    expect(output).not.toContain("| MEX  3");
  });

  test("starts the Discord bot with parsed environment config", async () => {
    const lines: string[] = [];
    const store = createStore();
    const startDiscord = vi.fn(
      async (..._args: Parameters<CliDependencies["startDiscord"]>) => undefined
    );
    const startInterval = vi.fn(() => ({ stop: vi.fn() }));
    const upsertBracketMessage = vi.fn(async () => "bracket-message-1");
    const upsertThirdPlaceMessage = vi.fn(async () => "third-place-message-1");
    const upsertChaosDashboardMessage = vi.fn(async () => "chaos-message-1");

    await runCli(["bot"], {
      openDatabase: () => store,
      writeLine: (line) => lines.push(line),
      env: {
        DISCORD_BOT_TOKEN: "token-value",
        DISCORD_GUILD_ID: "guild-1",
        DISCORD_CHANNEL_ID: "channel-1",
        COPANALHAS_DATABASE_PATH: "./tmp/bot.sqlite"
      },
      startDiscord,
      startInterval,
      sendMatchCard: vi.fn(async () => "discord-message-1"),
      upsertStandingsMessage: vi.fn(async (message) => `standings-${message.key}`),
      upsertLeaderboardMessage: vi.fn(async () => "leaderboard-message-1"),
      renderLeaderboardPng: vi.fn(async () => Buffer.from("png")),
      upsertBracketMessage,
      renderBracketPng: vi.fn(async () => Buffer.from("png")),
      upsertThirdPlaceMessage,
      renderThirdPlacePng: vi.fn(async () => Buffer.from("png")),
      upsertChaosDashboardMessage,
      renderChaosDashboardPng: vi.fn(async () => Buffer.from("png")),
      now: () => new Date("2026-06-11T12:00:00.000Z")
    });

    expect(store.upsertMatches).toHaveBeenCalled();
    expect(startDiscord).toHaveBeenCalledWith(
      expect.objectContaining({
        discordToken: "token-value",
        guildId: "guild-1",
        channelId: "channel-1",
        databasePath: "./tmp/bot.sqlite"
      }),
      expect.any(Function),
      expect.objectContaining({
        guildId: "guild-1",
        channelId: "channel-1",
        matches: expect.arrayContaining([
          expect.objectContaining({
            id: "wc2026-001",
            matchNumber: 1
          })
        ]),
        upsertPrediction: expect.any(Function)
      }),
      expect.objectContaining({
        operatorCommandOptions: expect.objectContaining({
          guildId: "guild-1",
          channelId: "channel-1"
        }),
        registerCommands: expect.any(Function)
      })
    );
    expect(startInterval).toHaveBeenCalled();
    expect(lines).toEqual([
      "[2026-06-11T12:00:00.000Z][bot] Starting Discord collector for configured channel.",
      "[2026-06-11T12:00:00.000Z][dashboard] standings posts=2 posted=2 edited=0 replaced=0 image=2 fallback=0",
      "[2026-06-11T12:00:00.000Z][dashboard] leaderboard action=posted message=leaderboard-message-1 render=image",
      "[2026-06-11T12:00:00.000Z][dashboard] bracket action=posted message=bracket-message-1 phase=provisional render=image",
      "[2026-06-11T12:00:00.000Z][dashboard] thirdPlaces action=posted message=third-place-message-1 status=needs-manual-tiebreaker render=image",
      "[2026-06-11T12:00:00.000Z][dashboard] recap posts=0 posted=0 edited=0 replaced=0 skipped=3 incomplete=3 alreadyPosted=0",
      "[2026-06-11T12:00:00.000Z][auto-post] date=2026-06-11 windowDays=3 posted=8 skipped=0",
      "[2026-06-11T12:00:00.000Z][result-sync] disabled reason=disabled",
      "[2026-06-11T12:00:00.000Z][health] discord=online guild=guild-1 channel=channel-1",
      "[2026-06-11T12:00:00.000Z][health] local=2026-06-11 09:00 timezone=America/Sao_Paulo autoPost=on@09:00 windowDays=3",
      "[2026-06-11T12:00:00.000Z][health] nextMatchday=2026-06-11 matches=2 posted=2/2",
      "[2026-06-11T12:00:00.000Z][health] predictions open=2 closed=0 missingKickoff=0 pendingReveals=0",
      "[2026-06-11T12:00:00.000Z][health] footballData=missing-token resultSync=off nextResultCheck=disabled reason=disabled pendingResults=0",
      "[2026-06-11T12:00:00.000Z][health] dashboards standings=2/2 leaderboard=present bracket=present thirdPlaces=present recaps=0 recapPeriods=none lastLeaderboard=2026-06-11T12:00:00.000Z lastBracket=2026-06-11T12:00:00.000Z lastThirdPlaces=2026-06-11T12:00:00.000Z lastRecap=never",
      "[2026-06-11T12:00:00.000Z][bot] Autonomous operator enabled. Auto-post: on at 09:00 America/Sao_Paulo."
    ]);

    const readyOptions = startDiscord.mock.calls[0]?.[3];
    readyOptions?.logAsyncError?.(
      "operator-command",
      Object.assign(new Error("Unknown interaction"), {
        code: 10062,
        status: 404,
        url: "https://discord.com/api/v10/interactions/1516068372414992436/secret-token/callback"
      })
    );

    expect(lines.at(-1)).toBe(
      "[2026-06-11T12:00:00.000Z][discord] handler=operator-command message=Unknown interaction code=10062 status=404"
    );
    expect(lines.at(-1)).not.toContain("secret-token");
  });

  test("prints config errors before starting the bot", async () => {
    const lines: string[] = [];
    const startDiscord = vi.fn(async () => undefined);

    await runCli(["bot"], {
      openDatabase: () => {
        throw new Error("database should not open");
      },
      writeLine: (line) => lines.push(line),
      env: {},
      startDiscord
    });

    expect(startDiscord).not.toHaveBeenCalled();
    expect(lines).toEqual([
      "DISCORD_BOT_TOKEN is required",
      "DISCORD_GUILD_ID is required",
      "DISCORD_CHANNEL_ID is required"
    ]);
  });

  test("logs top-level CLI errors with timestamped sanitized output", () => {
    const lines: string[] = [];

    logUnhandledCliError(
      Object.assign(
        new Error(
          "Boom https://discord.com/api/v10/interactions/1516068372414992436/secret-token/callback"
        ),
        {
          code: "E_CLI"
        }
      ),
      {
        now: () => new Date("2026-06-15T13:30:00.000Z"),
        writeLine: (line) => lines.push(line)
      }
    );

    expect(lines).toEqual([
      "[2026-06-15T13:30:00.000Z][runtime] scope=cli message=Boom https://discord.com/api/v*/interactions/[redacted]/[redacted]/callback code=E_CLI"
    ]);
  });

  test("logs interval callback errors with timestamped sanitized output", async () => {
    const errorLine = vi.spyOn(console, "error").mockImplementation(() => undefined);

    vi.useFakeTimers();

    try {
      const interval = startNodeInterval(
        async () => {
          throw Object.assign(
            new Error(
              "Tick failed https://discord.com/api/v10/interactions/1516068372414992436/secret-token/callback"
            ),
            {
              code: "E_TICK"
            }
          );
        },
        60_000,
        () => new Date("2026-06-15T13:31:00.000Z")
      );

      await vi.advanceTimersByTimeAsync(60_000);
      interval.stop();

      expect(errorLine).toHaveBeenCalledWith(
        "[2026-06-15T13:31:00.000Z][runtime] scope=interval message=Tick failed https://discord.com/api/v*/interactions/[redacted]/[redacted]/callback code=E_TICK"
      );
    } finally {
      vi.useRealTimers();
      errorLine.mockRestore();
    }
  });

  test("prints usage for unknown commands", async () => {
    const lines: string[] = [];

    await runCli(["wat"], {
      openDatabase: () => {
        throw new Error("database should not open");
      },
      writeLine: (line) => lines.push(line),
      env: {},
      startDiscord: async () => undefined
    });

    expect(lines).toEqual([
      "Usage: npm run dev -- seed-matches | post-matches-today [YYYY-MM-DD] | clear-posted-date [YYYY-MM-DD] | record-result <matchId> <homeScore> <awayScore> | leaderboard | standings-preview | bot"
    ]);
  });
});

function createStore(overrides: Partial<CliStore> = {}): CliStore {
  return {
    ...createStoreShape(),
    ...overrides
  };
}

const currentSeedRankOrderByGroup = {
  A: ["MEX", "RSA", "KOR", "CZE"],
  B: ["CAN", "BIH", "QAT", "SUI"]
} as const satisfies Record<string, readonly string[]>;
const currentSeedRankOrders: Readonly<Record<string, readonly string[]>> =
  currentSeedRankOrderByGroup;

function currentSeedProofStoredResultsForGroups(groups: readonly string[]): ReturnType<CliStore["listResults"]> {
  const results: ReturnType<CliStore["listResults"]> = [];

  for (const match of WORLD_CUP_2026_SEED.matches.filter(isGroupStageMatch)) {
    if (!groups.includes(match.group)) {
      continue;
    }

    const homeRank = currentSeedRank(match.group, match.homeTeam.code);
    const awayRank = currentSeedRank(match.group, match.awayTeam.code);
    const winnerIsHome = homeRank < awayRank;

    results.push({
      matchId: match.id,
      homeScore: winnerIsHome ? 3 : 0,
      awayScore: winnerIsHome ? 0 : 3,
      recordedAt: "2026-06-24T15:00:00.000Z",
      resultSource: "manual" as const,
      externalMatchId: null,
      fetchedAt: null
    });
  }

  return results;
}

function currentSeedRank(group: string, teamCode: string): number {
  const order = currentSeedRankOrders[group];
  const index = order?.indexOf(teamCode) ?? -1;

  if (index < 0) {
    throw new Error(`Missing proof-test rank for Group ${group} team ${teamCode}.`);
  }

  return index + 1;
}

function createStoreShape(): CliStore {
  const postedMatchCards: ReturnType<CliStore["listPostedMatchCards"]> = [];
  const predictionRevealPosts: ReturnType<CliStore["listPredictionRevealPosts"]> = [];
  const matchStartAlerts: ReturnType<CliStore["listMatchStartAlerts"]> = [];
  const standingsPosts: ReturnType<CliStore["listStandingsPosts"]> = [];
  const leaderboardPosts: ReturnType<CliStore["listLeaderboardPosts"]> = [];
  const bracketPosts: ReturnType<CliStore["listBracketPosts"]> = [];
  const thirdPlacePosts: ReturnType<CliStore["listThirdPlacePosts"]> = [];
  const chaosDashboardPosts: ReturnType<CliStore["listChaosDashboardPosts"]> = [];
  const chaosWeeklySnapshotRows: ReturnType<CliStore["listChaosWeeklySnapshotRows"]> = [];

  return {
    migrate: vi.fn(),
    upsertMatches: vi.fn(),
    upsertPrediction: vi.fn(),
    upsertResult: vi.fn(),
    listPredictions: vi.fn(() => [] as ReturnType<CliStore["listPredictions"]>),
    listResults: vi.fn(() => [] as ReturnType<CliStore["listResults"]>),
    listPostedMatchCards: vi.fn(() => postedMatchCards),
    recordPostedMatchCard: vi.fn((card) => {
      upsertBy(
        postedMatchCards,
        card,
        (stored) => `${stored.matchId}|${stored.channelId}`,
        (next) => `${next.matchId}|${next.channelId}`
      );
    }),
    listPredictionRevealPosts: vi.fn(() => predictionRevealPosts),
    recordPredictionRevealPost: vi.fn((post) => {
      upsertBy(
        predictionRevealPosts,
        post,
        (stored) => `${stored.matchId}|${stored.channelId}`,
        (next) => `${next.matchId}|${next.channelId}`
      );
    }),
    listMatchStartAlerts: vi.fn(() => matchStartAlerts),
    recordMatchStartAlert: vi.fn((alert) => {
      upsertBy(
        matchStartAlerts,
        alert,
        (stored) => `${stored.matchId}|${stored.channelId}`,
        (next) => `${next.matchId}|${next.channelId}`
      );
    }),
    markMatchStartAlertsDeleted: vi.fn((matchIds, deletedAt) => {
      let changes = 0;

      for (const alert of matchStartAlerts) {
        if (matchIds.includes(alert.matchId)) {
          alert.deletedAt = deletedAt;
          changes += 1;
        }
      }

      return changes;
    }),
    clearPostedMatchCardsForDate: vi.fn(() => 0),
    clearPredictionsForMatches: vi.fn(() => 0),
    clearResultsForMatches: vi.fn(() => 0),
    clearPredictionRevealPostsForMatches: vi.fn(() => 0),
    clearMatchStartAlertsForMatches: vi.fn(() => 0),
    listStandingsPosts: vi.fn(() => standingsPosts),
    recordStandingsPost: vi.fn((post) => {
      upsertBy(
        standingsPosts,
        post,
        (stored) => `${stored.postKey}|${stored.guildId}|${stored.channelId}`,
        (next) => `${next.postKey}|${next.guildId}|${next.channelId}`
      );
    }),
    listLeaderboardPosts: vi.fn(() => leaderboardPosts),
    recordLeaderboardPost: vi.fn((post) => {
      upsertBy(
        leaderboardPosts,
        post,
        (stored) => `${stored.guildId}|${stored.channelId}`,
        (next) => `${next.guildId}|${next.channelId}`
      );
    }),
    listBracketPosts: vi.fn(() => bracketPosts),
    recordBracketPost: vi.fn((post) => {
      upsertBy(
        bracketPosts,
        post,
        (stored) => `${stored.guildId}|${stored.channelId}`,
        (next) => `${next.guildId}|${next.channelId}`
      );
    }),
    listThirdPlacePosts: vi.fn(() => thirdPlacePosts),
    recordThirdPlacePost: vi.fn((post) => {
      upsertBy(
        thirdPlacePosts,
        post,
        (stored) => `${stored.guildId}|${stored.channelId}`,
        (next) => `${next.guildId}|${next.channelId}`
      );
    }),
    listChaosDashboardPosts: vi.fn(() => chaosDashboardPosts),
    recordChaosDashboardPost: vi.fn((post) => {
      upsertBy(
        chaosDashboardPosts,
        post,
        (stored) => `${stored.guildId}|${stored.channelId}`,
        (next) => `${next.guildId}|${next.channelId}`
      );
    }),
    listChaosWeeklySnapshotRows: vi.fn(() => chaosWeeklySnapshotRows),
    recordChaosWeeklySnapshotRows: vi.fn((weekStart, guildId, channelId, rows, createdAt) => {
      for (const row of rows) {
        upsertBy(
          chaosWeeklySnapshotRows,
          {
            ...row,
            weekStart,
            guildId,
            channelId,
            createdAt
          },
          (stored) => `${stored.weekStart}|${stored.guildId}|${stored.channelId}|${stored.userId}`,
          (next) => `${next.weekStart}|${next.guildId}|${next.channelId}|${next.userId}`
        );
      }
    }),
    insertScoringRun: vi.fn(),
    close: vi.fn()
  };
}

function upsertBy<T>(
  rows: T[],
  next: T,
  storedKey: (row: T) => string,
  nextKey: (row: T) => string
): void {
  const key = nextKey(next);
  const index = rows.findIndex((row) => storedKey(row) === key);

  if (index === -1) {
    rows.push(next);
  } else {
    rows.splice(index, 1, next);
  }
}
