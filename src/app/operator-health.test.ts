import { describe, expect, test } from "vitest";

import {
  formatOperatorHealthLogLines,
  formatOperatorHealthReport,
  type OperatorHealthSnapshot
} from "./operator-health.js";

describe("operator health formatting", () => {
  test("formats a morning checklist for Discord status replies", () => {
    expect(formatOperatorHealthReport(healthSnapshot())).toEqual([
      "Copanalhas Health",
      "Discord: online",
      "Route: guild guild-1, channel channel-1",
      "Local time: 2026-06-11 18:00 America/Sao_Paulo",
      "Auto-post: on at 09:00 America/Sao_Paulo (3 day window)",
      "Next matchday post: 2026-06-11 (2 matches, 1/2 posted)",
      "Prediction windows: 1 open, 1 closed, 0 missing kickoff",
      "Pending locked reveals: 1 (#2 Coreia do Sul x Tchéquia)",
      "Football Data: configured, result sync on",
      "Next result-sync check: 2026-06-11T20:50:00.000Z (2 pending)",
      "Last auto-post: posted 1, skipped 1 across 3 days from 2026-06-11",
      "Last result sync: waiting for 2 pending matches; next check 2026-06-11T20:50:00.000Z",
      "Dashboards: standings 1/2, leaderboard present",
      "Last leaderboard update: 2026-06-11T18:00:00.000Z",
      "Data: 72 matches loaded, 0 missing kickoff times"
    ]);
  });

  test("formats compact startup console lines", () => {
    expect(formatOperatorHealthLogLines(healthSnapshot())).toEqual([
      "[health] discord=online guild=guild-1 channel=channel-1",
      "[health] local=2026-06-11 18:00 timezone=America/Sao_Paulo autoPost=on@09:00 windowDays=3",
      "[health] nextMatchday=2026-06-11 matches=2 posted=1/2",
      "[health] predictions open=1 closed=1 missingKickoff=0 pendingReveals=1",
      "[health] footballData=configured resultSync=on nextResultCheck=2026-06-11T20:50:00.000Z pendingResults=2",
      "[health] dashboards standings=1/2 leaderboard=present lastLeaderboard=2026-06-11T18:00:00.000Z"
    ]);
  });
});

function healthSnapshot(): OperatorHealthSnapshot {
  return {
    discord: {
      online: true,
      guildId: "guild-1",
      channelId: "channel-1"
    },
    localDate: "2026-06-11",
    localTime: "18:00",
    timeZone: "America/Sao_Paulo",
    autoPostEnabled: true,
    autoPostTime: "09:00",
    autoPostWindowDays: 3,
    nextMatchday: {
      date: "2026-06-11",
      matchCount: 2,
      postedCount: 1
    },
    predictionWindows: {
      open: 1,
      closed: 1,
      missingKickoff: 0
    },
    pendingPredictionReveals: [
      {
        matchId: "wc2026-002",
        matchNumber: 2,
        label: "Coreia do Sul x Tchéquia"
      }
    ],
    footballDataConfigured: true,
    resultSyncEnabled: true,
    resultSyncPlan: {
      action: "not-due",
      nextCheckAtUtc: "2026-06-11T20:50:00.000Z",
      pendingMatchIds: ["wc2026-001", "wc2026-002"]
    },
    lastAutoPost: {
      action: "posted",
      localDate: "2026-06-11",
      windowDays: 3,
      dates: [
        {
          date: "2026-06-11",
          posted: ["wc2026-001"],
          skipped: ["wc2026-002"]
        }
      ],
      posted: ["wc2026-001"],
      skipped: ["wc2026-002"]
    },
    lastResultSync: {
      action: "not-due",
      nextCheckAtUtc: "2026-06-11T20:50:00.000Z",
      pendingMatchIds: ["wc2026-001", "wc2026-002"]
    },
    standingsPosts: {
      present: 1,
      expected: 2,
      lastUpdatedAt: "2026-06-11T18:00:00.000Z"
    },
    leaderboardPost: {
      present: true,
      lastUpdatedAt: "2026-06-11T18:00:00.000Z"
    },
    data: {
      matchesLoaded: 72,
      missingKickoffTimes: 0
    }
  };
}
