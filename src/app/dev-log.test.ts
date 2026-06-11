import { describe, expect, test } from "vitest";

import {
  formatAutoPostLog,
  formatLeaderboardDashboardLog,
  formatOperatorAutocompleteLog,
  formatOperatorCommandLog,
  formatPredictionInteractionLog,
  formatRuntimeLogLine,
  formatResultSyncLog,
  formatStandingsDashboardLog
} from "./dev-log.js";

describe("dev log formatting", () => {
  test("prefixes runtime logs with the current timestamp and category", () => {
    expect(
      formatRuntimeLogLine(
        new Date("2026-06-11T12:34:56.789Z"),
        "[health] discord=online guild=guild-1 channel=channel-1"
      )
    ).toBe("[2026-06-11T12:34:56.789Z][health] discord=online guild=guild-1 channel=channel-1");
  });

  test("formats operator command outcomes with routing and options", () => {
    expect(
      formatOperatorCommandLog(
        {
          guildId: "guild-1",
          channelId: "channel-1",
          userId: "operator-1",
          subcommand: "result",
          options: {
            match: "wc2026-001",
            score: "2-1"
          }
        },
        {
          action: "replied",
          content: "Recorded result wc2026-001 2-1.",
          ephemeral: true
        }
      )
    ).toBe(
      "[operator] subcommand=result user=operator-1 guild=guild-1 channel=channel-1 options=match:wc2026-001,score:2-1 -> replied ephemeral=true"
    );
  });

  test("formats autocomplete counts without dumping choices", () => {
    expect(
      formatOperatorAutocompleteLog(
        {
          guildId: "guild-1",
          channelId: "channel-1",
          userId: "operator-1",
          subcommand: "predictions",
          focusedOptionName: "match",
          focusedValue: "mex"
        },
        {
          action: "responded",
          choices: [
            { name: "#1", value: "wc2026-001" },
            { name: "#2", value: "wc2026-028" }
          ]
        }
      )
    ).toBe(
      "[autocomplete] subcommand=predictions option=match value=mex user=operator-1 guild=guild-1 channel=channel-1 -> responded choices=2"
    );
  });

  test("formats prediction interaction outcomes with match and score context", () => {
    expect(
      formatPredictionInteractionLog({
        action: "accepted",
        prediction: {
          userId: "user-1",
          matchId: "wc2026-001",
          messageId: "interaction-1",
          homeScore: 2,
          awayScore: 1,
          submittedAt: "2026-06-10T12:00:00.000Z",
          updatedAt: null,
          parserVersion: "prediction-modal-v1"
        }
      })
    ).toBe("[prediction] accepted user=user-1 match=wc2026-001 score=2-1 message=interaction-1");
  });

  test("formats automation and dashboard lifecycle logs", () => {
    expect(
      formatAutoPostLog({
        action: "posted",
        localDate: "2026-06-11",
        windowDays: 3,
        dates: [
          { date: "2026-06-11", posted: ["wc2026-001", "wc2026-002"], skipped: [] },
          { date: "2026-06-12", posted: [], skipped: ["wc2026-003"] }
        ],
        posted: ["wc2026-001", "wc2026-002"],
        skipped: ["wc2026-003"]
      })
    ).toBe("[auto-post] date=2026-06-11 windowDays=3 posted=2 skipped=1");

    expect(
      formatResultSyncLog({
        action: "synced",
        dateFrom: "2026-06-09",
        dateTo: "2026-06-11",
        storedResults: ["wc2026-001"],
        skipped: []
      })
    ).toBe("[result-sync] range=2026-06-09..2026-06-11 synced stored=1 skipped=0");

    expect(
      formatStandingsDashboardLog({
        action: "updated",
        posts: [
          { postKey: "groups_a_f", messageId: "message-a", action: "edited" },
          { postKey: "groups_g_l", messageId: "message-b", action: "replaced" }
        ]
      })
    ).toBe("[dashboard] standings posts=2 posted=0 edited=1 replaced=1");

    expect(
      formatLeaderboardDashboardLog({
        action: "updated",
        post: { messageId: "leaderboard-message-1", action: "posted" }
      })
    ).toBe("[dashboard] leaderboard action=posted message=leaderboard-message-1");
  });
});
