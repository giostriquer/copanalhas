import { describe, expect, test } from "vitest";

import {
  formatAutoPostLog,
  formatBracketDashboardLog,
  formatChaosDashboardLog,
  formatDiscordAsyncErrorLog,
  formatLeaderboardDashboardLog,
  formatOperatorAutocompleteLog,
  formatOperatorCommandLog,
  formatPredictionInteractionLog,
  formatRuntimeLogLine,
  formatRuntimeAsyncErrorLog,
  formatResultSyncErrorLog,
  formatResultSyncLog,
  formatResultSyncStartLog,
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

  test("formats operator command outcomes with routing and redacted score options", () => {
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
      "[operator] subcommand=result user=operator-1 guild=guild-1 channel=channel-1 options=match:wc2026-001,score:<redacted> -> replied ephemeral=true"
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

  test("formats async runtime errors without leaking callback tokens", () => {
    const error = Object.assign(
      new Error(
        "Unknown interaction https://discord.com/api/v10/interactions/1516068372414992436/secret-token/callback?with_response=false"
      ),
      {
        code: 10062,
        status: 404
      }
    );

    expect(formatRuntimeAsyncErrorLog({ scope: "interval", error })).toBe(
      "[runtime] scope=interval message=Unknown interaction https://discord.com/api/v*/interactions/[redacted]/[redacted]/callback code=10062 status=404"
    );
    expect(formatDiscordAsyncErrorLog({ handler: "operator-command", error })).toBe(
      "[discord] handler=operator-command message=Unknown interaction https://discord.com/api/v*/interactions/[redacted]/[redacted]/callback code=10062 status=404"
    );
  });

  test("formats prediction interaction outcomes with match context and redacted scores", () => {
    const prediction = {
      userId: "user-1",
      matchId: "wc2026-001",
      messageId: "interaction-1",
      homeScore: 2,
      awayScore: 1,
      submittedAt: "2026-06-10T12:00:00.000Z",
      updatedAt: null,
      parserVersion: "prediction-modal-v1"
    };

    expect(
      formatPredictionInteractionLog({
        action: "accepted",
        prediction
      })
    ).toBe(
      "[prediction] accepted user=user-1 match=wc2026-001 score=<redacted> decision=none message=interaction-1"
    );
    expect(prediction).toMatchObject({ homeScore: 2, awayScore: 1 });
  });

  test("logs knockout decision methods without logging the score", () => {
    const prediction = {
      userId: "user-1",
      matchId: "wc2026-073",
      messageId: "interaction-1",
      homeScore: 1,
      awayScore: 3,
      decisionMethod: "penalties" as const,
      submittedAt: "2026-06-28T12:00:00.000Z",
      updatedAt: null,
      parserVersion: "prediction-modal-v1"
    };

    const line = formatPredictionInteractionLog({
      action: "accepted",
      prediction
    });

    expect(line).toBe(
      "[prediction] accepted user=user-1 match=wc2026-073 score=<redacted> decision=penalties message=interaction-1"
    );
    expect(line).not.toContain("1-3");
    expect(line).not.toContain("1x3");
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
        skipped: [],
        skippedDetails: []
      })
    ).toBe("[result-sync] range=2026-06-09..2026-06-11 synced stored=1 skipped=0");

    expect(
      formatResultSyncLog({
        action: "synced",
        dateFrom: "2026-06-11",
        dateTo: "2026-06-11",
        storedResults: [],
        skipped: ["wc2026-001"],
        skippedDetails: [
          { matchId: "wc2026-001", reason: "missing-final-score", providerStatus: "FINISHED" }
        ]
      })
    ).toBe(
      "[result-sync] range=2026-06-11..2026-06-11 synced stored=0 skipped=1 manual=0 notFinal=0 missingScore=1"
    );

    expect(
      formatResultSyncStartLog({
        mode: "scheduled",
        dateFrom: "2026-06-09",
        dateTo: "2026-06-11",
        pendingMatchIds: ["wc2026-001", "wc2026-002"]
      })
    ).toBe("[result-sync] start mode=scheduled range=2026-06-09..2026-06-11 pending=2");

    expect(
      formatResultSyncErrorLog({
        mode: "scheduled",
        dateFrom: "2026-06-09",
        dateTo: "2026-06-11",
        error: new Error("Football Data timeout\nwith detail")
      })
    ).toBe(
      "[result-sync] error mode=scheduled range=2026-06-09..2026-06-11 message=Football Data timeout with detail"
    );

    expect(
      formatStandingsDashboardLog({
        action: "updated",
        posts: [
          { postKey: "groups_a_f", messageId: "message-a", action: "edited", renderState: "image" },
          {
            postKey: "groups_g_l",
            messageId: "message-b",
            action: "replaced",
            renderState: "text-fallback",
            renderError: "sharp failed"
          }
        ]
      })
    ).toBe("[dashboard] standings posts=2 posted=0 edited=1 replaced=1 image=1 fallback=1 errors=1");

    expect(
      formatLeaderboardDashboardLog({
        action: "updated",
        post: { messageId: "leaderboard-message-1", action: "posted" },
        renderState: "image"
      })
    ).toBe("[dashboard] leaderboard action=posted message=leaderboard-message-1 render=image");

    expect(
      formatBracketDashboardLog({
        action: "updated",
        post: { messageId: "bracket-message-1", action: "edited" },
        bracketPhase: "provisional",
        renderState: "image"
      })
    ).toBe(
      "[dashboard] bracket action=edited message=bracket-message-1 phase=provisional render=image"
    );

    expect(
      formatBracketDashboardLog({
        action: "updated",
        post: { messageId: "bracket-message-1", action: "edited" },
        bracketPhase: "blocked",
        renderState: "text-fallback",
        renderError: "sharp failed badly"
      })
    ).toBe(
      "[dashboard] bracket action=edited message=bracket-message-1 phase=blocked render=text-fallback error=sharp failed badly"
    );

    expect(
      formatChaosDashboardLog({
        action: "updated",
        posted: [
          {
            periodKey: "group-week-1",
            messageId: "chaos-message-1",
            action: "posted",
            renderState: "image"
          }
        ],
        skipped: [
          { periodKey: "group-week-2", reason: "incomplete" },
          { periodKey: "group-week-3", reason: "incomplete" }
        ]
      })
    ).toBe(
      "[dashboard] recap posts=1 posted=1 edited=0 replaced=0 skipped=2 incomplete=2 alreadyPosted=0 periods=group-week-1 copyApplied=0 copyFallback=0 copyDisabled=1"
    );

    expect(
      formatChaosDashboardLog({
        action: "updated",
        posted: [
          {
            periodKey: "group-week-1",
            messageId: "chaos-message-1",
            action: "edited",
            renderState: "text-fallback",
            renderError: "sharp failed badly"
          }
        ],
        skipped: []
      })
    ).toBe(
      "[dashboard] recap posts=1 posted=0 edited=1 replaced=0 skipped=0 incomplete=0 alreadyPosted=0 periods=group-week-1 copyApplied=0 copyFallback=0 copyDisabled=1 errors=group-week-1:sharp failed badly"
    );

    expect(
      formatChaosDashboardLog({
        action: "updated",
        posted: [
          {
            periodKey: "group-week-1",
            messageId: "chaos-message-1",
            action: "posted",
            renderState: "image",
            copyState: "fallback",
            copyError: "codex failed with Bot secret-token"
          }
        ],
        skipped: []
      })
    ).toBe(
      "[dashboard] recap posts=1 posted=1 edited=0 replaced=0 skipped=0 incomplete=0 alreadyPosted=0 periods=group-week-1 copyApplied=0 copyFallback=1 copyDisabled=0 copyErrors=group-week-1:codex failed with Bot [redacted]"
    );
  });
});
