import { describe, expect, test } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { openCopanalhasDatabase } from "./database.js";
import { WORLD_CUP_2026_SEED } from "../worldcup/seed.js";

describe("CopanalhasDatabase", () => {
  test("creates schema and upserts matches", () => {
    const store = openCopanalhasDatabase(":memory:");
    const [firstMatch] = WORLD_CUP_2026_SEED.matches;

    if (!firstMatch) {
      throw new Error("World Cup seed needs at least one match for storage tests");
    }

    store.migrate();
    store.upsertMatches([firstMatch]);

    expect(store.listMatches()).toEqual([firstMatch]);
    store.close();
  });

  test("round-trips knockout fixture metadata without forcing a group name", () => {
    const store = openCopanalhasDatabase(":memory:");
    const knockoutMatch = WORLD_CUP_2026_SEED.matches.find(
      (match) => match.matchNumber === 73
    );

    if (!knockoutMatch) {
      throw new Error("World Cup seed needs knockout match #73 for storage tests");
    }

    store.migrate();
    store.upsertMatches([knockoutMatch]);

    expect(store.listMatches()).toEqual([knockoutMatch]);
    store.close();
  });

  test("upserts the latest prediction for a user and match", () => {
    const store = openCopanalhasDatabase(":memory:");
    store.migrate();

    store.upsertPrediction({
      userId: "user-1",
      matchId: "wc2026-001",
      messageId: "message-1",
      homeScore: 1,
      awayScore: 0,
      submittedAt: "2026-06-10T12:00:00.000Z",
      updatedAt: null,
      parserVersion: "prediction-parser-v1"
    });
    store.upsertPrediction({
      userId: "user-1",
      matchId: "wc2026-001",
      messageId: "message-2",
      homeScore: 2,
      awayScore: 1,
      submittedAt: "2026-06-10T12:05:00.000Z",
      updatedAt: "2026-06-10T12:06:00.000Z",
      parserVersion: "prediction-parser-v1"
    });

    expect(store.listPredictions()).toEqual([
      {
        userId: "user-1",
        matchId: "wc2026-001",
        messageId: "message-2",
        homeScore: 2,
        awayScore: 1,
        submittedAt: "2026-06-10T12:05:00.000Z",
        updatedAt: "2026-06-10T12:06:00.000Z",
        parserVersion: "prediction-parser-v1"
      }
    ]);
    store.close();
  });

  test("round-trips knockout prediction decision methods", () => {
    const store = openCopanalhasDatabase(":memory:");
    store.migrate();

    store.upsertPrediction({
      userId: "user-1",
      matchId: "wc2026-073",
      messageId: "interaction-1",
      homeScore: 1,
      awayScore: 1,
      decisionMethod: "penalties",
      submittedAt: "2026-06-29T12:00:00.000Z",
      updatedAt: null,
      parserVersion: "prediction-modal-v2"
    } as Parameters<typeof store.upsertPrediction>[0]);

    expect(store.listPredictions()).toEqual([
      {
        userId: "user-1",
        matchId: "wc2026-073",
        messageId: "interaction-1",
        homeScore: 1,
        awayScore: 1,
        decisionMethod: "penalties",
        submittedAt: "2026-06-29T12:00:00.000Z",
        updatedAt: null,
        parserVersion: "prediction-modal-v2"
      }
    ]);
    store.close();
  });

  test("upserts final results by match", () => {
    const store = openCopanalhasDatabase(":memory:");
    store.migrate();

    store.upsertResult({
      matchId: "wc2026-001",
      homeScore: 2,
      awayScore: 1,
      recordedAt: "2026-06-11T23:00:00.000Z",
      resultSource: "football-data",
      externalMatchId: "12345",
      fetchedAt: "2026-06-11T23:01:00.000Z"
    });
    store.upsertResult({
      matchId: "wc2026-001",
      homeScore: 3,
      awayScore: 1,
      recordedAt: "2026-06-11T23:05:00.000Z",
      resultSource: "manual",
      externalMatchId: null,
      fetchedAt: null
    });

    expect(store.listResults()).toEqual([
      {
        matchId: "wc2026-001",
        homeScore: 3,
        awayScore: 1,
        recordedAt: "2026-06-11T23:05:00.000Z",
        resultSource: "manual",
        externalMatchId: null,
        fetchedAt: null
      }
    ]);
    store.close();
  });

  test("round-trips detailed knockout result scoring fields", () => {
    const store = openCopanalhasDatabase(":memory:");
    store.migrate();

    store.upsertResult({
      matchId: "wc2026-073",
      homeScore: 6,
      awayScore: 5,
      decisionMethod: "penalties",
      regularTimeHomeScore: 1,
      regularTimeAwayScore: 1,
      extraTimeHomeScore: 1,
      extraTimeAwayScore: 1,
      penaltyHomeScore: 5,
      penaltyAwayScore: 4,
      winner: "home",
      recordedAt: "2026-06-29T23:00:00.000Z",
      resultSource: "manual",
      externalMatchId: null,
      fetchedAt: null
    } as Parameters<typeof store.upsertResult>[0]);

    expect(store.listResults()).toEqual([
      {
        matchId: "wc2026-073",
        homeScore: 6,
        awayScore: 5,
        decisionMethod: "penalties",
        regularTimeHomeScore: 1,
        regularTimeAwayScore: 1,
        extraTimeHomeScore: 1,
        extraTimeAwayScore: 1,
        penaltyHomeScore: 5,
        penaltyAwayScore: 4,
        winner: "home",
        recordedAt: "2026-06-29T23:00:00.000Z",
        resultSource: "manual",
        externalMatchId: null,
        fetchedAt: null
      }
    ]);
    store.close();
  });

  test("clears predictions and results for selected matches only", () => {
    const store = openCopanalhasDatabase(":memory:");
    store.migrate();

    store.upsertPrediction({
      userId: "user-1",
      matchId: "wc2026-001",
      messageId: "message-1",
      homeScore: 1,
      awayScore: 0,
      submittedAt: "2026-06-10T12:00:00.000Z",
      updatedAt: null,
      parserVersion: "prediction-modal-v1"
    });
    store.upsertPrediction({
      userId: "user-2",
      matchId: "wc2026-002",
      messageId: "message-2",
      homeScore: 2,
      awayScore: 1,
      submittedAt: "2026-06-10T12:01:00.000Z",
      updatedAt: null,
      parserVersion: "prediction-modal-v1"
    });
    store.upsertPrediction({
      userId: "user-3",
      matchId: "wc2026-003",
      messageId: "message-3",
      homeScore: 0,
      awayScore: 0,
      submittedAt: "2026-06-10T12:02:00.000Z",
      updatedAt: null,
      parserVersion: "prediction-modal-v1"
    });
    store.upsertResult({
      matchId: "wc2026-001",
      homeScore: 2,
      awayScore: 1,
      recordedAt: "2026-06-11T23:00:00.000Z",
      resultSource: "manual",
      externalMatchId: null,
      fetchedAt: null
    });
    store.upsertResult({
      matchId: "wc2026-003",
      homeScore: 1,
      awayScore: 1,
      recordedAt: "2026-06-12T23:00:00.000Z",
      resultSource: "manual",
      externalMatchId: null,
      fetchedAt: null
    });

    expect(store.clearPredictionsForMatches(["wc2026-001", "wc2026-002"])).toBe(2);
    expect(store.clearResultsForMatches(["wc2026-001", "wc2026-002"])).toBe(1);
    expect(store.listPredictions().map((prediction) => prediction.matchId)).toEqual(["wc2026-003"]);
    expect(store.listResults().map((result) => result.matchId)).toEqual(["wc2026-003"]);
    store.close();
  });

  test("records posted match cards by match and channel", () => {
    const store = openCopanalhasDatabase(":memory:");
    store.migrate();

    store.recordPostedMatchCard({
      matchId: "wc2026-001",
      channelId: "channel-1",
      messageId: "discord-message-1",
      postedForDate: "2026-06-11",
      postedAt: "2026-06-11T12:00:00.000Z",
      postSource: "command"
    });

    expect(store.listPostedMatchCards()).toEqual([
      {
        matchId: "wc2026-001",
        channelId: "channel-1",
        messageId: "discord-message-1",
        postedForDate: "2026-06-11",
        postedAt: "2026-06-11T12:00:00.000Z",
        postSource: "command"
      }
    ]);
    store.close();
  });

  test("clears posted match cards for one date and channel only", () => {
    const store = openCopanalhasDatabase(":memory:");
    store.migrate();

    store.recordPostedMatchCard({
      matchId: "wc2026-001",
      channelId: "channel-1",
      messageId: "discord-message-1",
      postedForDate: "2026-06-11",
      postedAt: "2026-06-11T12:00:00.000Z",
      postSource: "command"
    });
    store.recordPostedMatchCard({
      matchId: "wc2026-002",
      channelId: "channel-1",
      messageId: "discord-message-1",
      postedForDate: "2026-06-11",
      postedAt: "2026-06-11T12:00:00.000Z",
      postSource: "command"
    });
    store.recordPostedMatchCard({
      matchId: "wc2026-003",
      channelId: "channel-1",
      messageId: "discord-message-2",
      postedForDate: "2026-06-12",
      postedAt: "2026-06-12T12:00:00.000Z",
      postSource: "command"
    });
    store.recordPostedMatchCard({
      matchId: "wc2026-001",
      channelId: "channel-2",
      messageId: "discord-message-3",
      postedForDate: "2026-06-11",
      postedAt: "2026-06-11T12:00:00.000Z",
      postSource: "command"
    });

    expect(store.clearPostedMatchCardsForDate("channel-1", "2026-06-11")).toBe(2);
    expect(store.listPostedMatchCards()).toEqual([
      {
        matchId: "wc2026-001",
        channelId: "channel-2",
        messageId: "discord-message-3",
        postedForDate: "2026-06-11",
        postedAt: "2026-06-11T12:00:00.000Z",
        postSource: "command"
      },
      {
        matchId: "wc2026-003",
        channelId: "channel-1",
        messageId: "discord-message-2",
        postedForDate: "2026-06-12",
        postedAt: "2026-06-12T12:00:00.000Z",
        postSource: "command"
      }
    ]);
    store.close();
  });

  test("records prediction reveal posts by match and channel", () => {
    const store = openCopanalhasDatabase(":memory:");
    store.migrate();

    store.recordPredictionRevealPost({
      matchId: "wc2026-001",
      channelId: "channel-1",
      threadId: "thread-1",
      messageId: "reveal-message-1",
      revealedAt: "2026-06-11T18:30:00.000Z",
      closeAtUtc: "2026-06-11T18:30:00.000Z",
      resultRevealedAt: null
    });
    store.recordPredictionRevealPost({
      matchId: "wc2026-001",
      channelId: "channel-1",
      threadId: "thread-2",
      messageId: "reveal-message-2",
      revealedAt: "2026-06-11T18:35:00.000Z",
      closeAtUtc: "2026-06-11T18:30:00.000Z",
      resultRevealedAt: "2026-06-11T22:30:00.000Z"
    });

    expect(store.listPredictionRevealPosts()).toEqual([
      {
        matchId: "wc2026-001",
        channelId: "channel-1",
        threadId: "thread-2",
        messageId: "reveal-message-2",
        revealedAt: "2026-06-11T18:35:00.000Z",
        closeAtUtc: "2026-06-11T18:30:00.000Z",
        resultRevealedAt: "2026-06-11T22:30:00.000Z"
      }
    ]);
    store.close();
  });

  test("clears prediction reveal posts for selected matches only", () => {
    const store = openCopanalhasDatabase(":memory:");
    store.migrate();

    store.recordPredictionRevealPost({
      matchId: "wc2026-001",
      channelId: "channel-1",
      threadId: "thread-1",
      messageId: "reveal-message-1",
      revealedAt: "2026-06-11T18:30:00.000Z",
      closeAtUtc: "2026-06-11T18:30:00.000Z",
      resultRevealedAt: null
    });
    store.recordPredictionRevealPost({
      matchId: "wc2026-002",
      channelId: "channel-1",
      threadId: "thread-1",
      messageId: "reveal-message-1",
      revealedAt: "2026-06-12T02:30:00.000Z",
      closeAtUtc: "2026-06-12T01:30:00.000Z",
      resultRevealedAt: null
    });

    expect(store.clearPredictionRevealPostsForMatches(["wc2026-001"])).toBe(1);
    expect(store.listPredictionRevealPosts().map((post) => post.matchId)).toEqual(["wc2026-002"]);
    store.close();
  });

  test("records match start alerts and marks them deleted by match", () => {
    const store = openCopanalhasDatabase(":memory:");
    store.migrate();

    store.recordMatchStartAlert({
      matchId: "wc2026-001",
      channelId: "channel-1",
      messageId: "match-start-message-1",
      postedAt: "2026-06-11T19:00:20.000Z",
      deleteAfterUtc: "2026-06-11T22:00:00.000Z",
      deletedAt: null
    });
    store.recordMatchStartAlert({
      matchId: "wc2026-002",
      channelId: "channel-1",
      messageId: "match-start-message-1",
      postedAt: "2026-06-11T19:00:20.000Z",
      deleteAfterUtc: "2026-06-11T22:00:00.000Z",
      deletedAt: null
    });

    store.markMatchStartAlertsDeleted(["wc2026-001"], "2026-06-11T21:10:00.000Z");

    expect(store.listMatchStartAlerts()).toEqual([
      {
        matchId: "wc2026-001",
        channelId: "channel-1",
        messageId: "match-start-message-1",
        postedAt: "2026-06-11T19:00:20.000Z",
        deleteAfterUtc: "2026-06-11T22:00:00.000Z",
        deletedAt: "2026-06-11T21:10:00.000Z"
      },
      {
        matchId: "wc2026-002",
        channelId: "channel-1",
        messageId: "match-start-message-1",
        postedAt: "2026-06-11T19:00:20.000Z",
        deleteAfterUtc: "2026-06-11T22:00:00.000Z",
        deletedAt: null
      }
    ]);
    store.close();
  });

  test("records standings dashboard posts by key, guild, and channel", () => {
    const store = openCopanalhasDatabase(":memory:");
    store.migrate();

    store.recordStandingsPost({
      postKey: "groups_a_f",
      guildId: "guild-1",
      channelId: "channel-1",
      messageId: "standings-message-1",
      createdAt: "2026-06-11T12:00:00.000Z",
      updatedAt: "2026-06-11T12:00:00.000Z"
    });
    store.recordStandingsPost({
      postKey: "groups_a_f",
      guildId: "guild-1",
      channelId: "channel-1",
      messageId: "standings-message-2",
      createdAt: "2026-06-11T12:00:00.000Z",
      updatedAt: "2026-06-11T12:05:00.000Z"
    });

    expect(store.listStandingsPosts()).toEqual([
      {
        postKey: "groups_a_f",
        guildId: "guild-1",
        channelId: "channel-1",
        messageId: "standings-message-2",
        createdAt: "2026-06-11T12:00:00.000Z",
        updatedAt: "2026-06-11T12:05:00.000Z"
      }
    ]);
    store.close();
  });

  test("records leaderboard dashboard posts by guild and channel", () => {
    const store = openCopanalhasDatabase(":memory:");
    store.migrate();

    store.recordLeaderboardPost({
      guildId: "guild-1",
      channelId: "channel-1",
      messageId: "leaderboard-message-1",
      createdAt: "2026-06-11T12:00:00.000Z",
      updatedAt: "2026-06-11T12:00:00.000Z"
    });
    store.recordLeaderboardPost({
      guildId: "guild-1",
      channelId: "channel-1",
      messageId: "leaderboard-message-2",
      createdAt: "2026-06-11T12:00:00.000Z",
      updatedAt: "2026-06-11T12:05:00.000Z"
    });

    expect(store.listLeaderboardPosts()).toEqual([
      {
        guildId: "guild-1",
        channelId: "channel-1",
        messageId: "leaderboard-message-2",
        createdAt: "2026-06-11T12:00:00.000Z",
        updatedAt: "2026-06-11T12:05:00.000Z"
      }
    ]);
    store.close();
  });

  test("records bracket dashboard posts by guild and channel", () => {
    const store = openCopanalhasDatabase(":memory:");
    store.migrate();

    store.recordBracketPost({
      guildId: "guild-1",
      channelId: "channel-1",
      messageId: "bracket-message-1",
      createdAt: "2026-06-11T12:00:00.000Z",
      updatedAt: "2026-06-11T12:00:00.000Z"
    });
    store.recordBracketPost({
      guildId: "guild-1",
      channelId: "channel-1",
      messageId: "bracket-message-2",
      createdAt: "2026-06-11T12:00:00.000Z",
      updatedAt: "2026-06-11T12:05:00.000Z"
    });

    expect(store.listBracketPosts()).toEqual([
      {
        guildId: "guild-1",
        channelId: "channel-1",
        messageId: "bracket-message-2",
        createdAt: "2026-06-11T12:00:00.000Z",
        updatedAt: "2026-06-11T12:05:00.000Z"
      }
    ]);
    store.close();
  });

  test("records third-place dashboard posts by guild and channel", () => {
    const store = openCopanalhasDatabase(":memory:");
    store.migrate();

    store.recordThirdPlacePost({
      guildId: "guild-1",
      channelId: "channel-1",
      messageId: "third-place-message-1",
      createdAt: "2026-06-11T12:00:00.000Z",
      updatedAt: "2026-06-11T12:00:00.000Z"
    });
    store.recordThirdPlacePost({
      guildId: "guild-1",
      channelId: "channel-1",
      messageId: "third-place-message-2",
      createdAt: "2026-06-11T12:00:00.000Z",
      updatedAt: "2026-06-11T12:05:00.000Z"
    });

    expect(store.listThirdPlacePosts()).toEqual([
      {
        guildId: "guild-1",
        channelId: "channel-1",
        messageId: "third-place-message-2",
        createdAt: "2026-06-11T12:00:00.000Z",
        updatedAt: "2026-06-11T12:05:00.000Z"
      }
    ]);
    store.close();
  });

  test("records chaos recap posts by guild, channel, and period", () => {
    const store = openCopanalhasDatabase(":memory:");
    store.migrate();

    store.recordChaosDashboardPost({
      periodKey: "group-week-1",
      guildId: "guild-1",
      channelId: "channel-1",
      messageId: "chaos-message-1",
      createdAt: "2026-06-22T12:00:00.000Z",
      updatedAt: "2026-06-22T12:00:00.000Z"
    });
    store.recordChaosDashboardPost({
      periodKey: "group-week-2",
      guildId: "guild-1",
      channelId: "channel-1",
      messageId: "chaos-message-2",
      createdAt: "2026-06-22T12:00:00.000Z",
      updatedAt: "2026-06-22T12:05:00.000Z"
    });
    store.recordChaosDashboardPost({
      periodKey: "group-week-1",
      guildId: "guild-1",
      channelId: "channel-1",
      messageId: "chaos-message-1-edited",
      createdAt: "2026-06-22T12:00:00.000Z",
      updatedAt: "2026-06-22T12:10:00.000Z"
    });

    expect(store.listChaosDashboardPosts()).toEqual([
      {
        periodKey: "group-week-1",
        guildId: "guild-1",
        channelId: "channel-1",
        messageId: "chaos-message-1-edited",
        createdAt: "2026-06-22T12:00:00.000Z",
        updatedAt: "2026-06-22T12:10:00.000Z"
      },
      {
        periodKey: "group-week-2",
        guildId: "guild-1",
        channelId: "channel-1",
        messageId: "chaos-message-2",
        createdAt: "2026-06-22T12:00:00.000Z",
        updatedAt: "2026-06-22T12:05:00.000Z"
      }
    ]);
    store.close();
  });

  test("records chaos weekly snapshot rows by week, guild, and channel", () => {
    const store = openCopanalhasDatabase(":memory:");
    store.migrate();

    store.recordChaosWeeklySnapshotRows(
      "2026-06-22",
      "guild-1",
      "channel-1",
      [
        {
          userId: "user-a",
          rank: 1,
          points: 5,
          soloCount: 1,
          exactCount: 0,
          outcomeCount: 0,
          closestCount: 0
        },
        {
          userId: "user-b",
          rank: 2,
          points: 3,
          soloCount: 0,
          exactCount: 1,
          outcomeCount: 0,
          closestCount: 0
        }
      ],
      "2026-06-22T12:00:00.000Z"
    );
    store.recordChaosWeeklySnapshotRows(
      "2026-06-22",
      "guild-1",
      "channel-1",
      [
        {
          userId: "user-a",
          rank: 1,
          points: 10,
          soloCount: 2,
          exactCount: 0,
          outcomeCount: 0,
          closestCount: 0
        }
      ],
      "2026-06-22T12:05:00.000Z"
    );

    expect(store.listChaosWeeklySnapshotRows("2026-06-22", "guild-1", "channel-1")).toEqual([
      {
        weekStart: "2026-06-22",
        guildId: "guild-1",
        channelId: "channel-1",
        userId: "user-a",
        rank: 1,
        points: 10,
        soloCount: 2,
        exactCount: 0,
        outcomeCount: 0,
        closestCount: 0,
        createdAt: "2026-06-22T12:05:00.000Z"
      },
      {
        weekStart: "2026-06-22",
        guildId: "guild-1",
        channelId: "channel-1",
        userId: "user-b",
        rank: 2,
        points: 3,
        soloCount: 0,
        exactCount: 1,
        outcomeCount: 0,
        closestCount: 0,
        createdAt: "2026-06-22T12:00:00.000Z"
      }
    ]);
    store.close();
  });

  test("records scoring runs with JSON summaries", () => {
    const store = openCopanalhasDatabase(":memory:");
    store.migrate();

    const run = store.insertScoringRun({
      createdAt: "2026-06-11T23:10:00.000Z",
      matchId: "wc2026-001",
      summary: {
        scoredPredictions: 3,
        leaderboardRows: 2
      }
    });

    expect(store.listScoringRuns()).toEqual([
      {
        id: run.id,
        createdAt: "2026-06-11T23:10:00.000Z",
        matchId: "wc2026-001",
        summary: {
          scoredPredictions: 3,
          leaderboardRows: 2
        }
      }
    ]);
    store.close();
  });

  test("creates parent directories for file-backed databases", () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "copanalhas-storage-"));
    const databasePath = join(tempRoot, "nested", "copanalhas.sqlite");

    try {
      const store = openCopanalhasDatabase(databasePath);
      store.migrate();
      store.close();
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }

    expect(true).toBe(true);
  });
});
