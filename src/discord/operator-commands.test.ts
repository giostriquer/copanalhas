import { describe, expect, test, vi } from "vitest";
import { MessageFlags, type Interaction } from "discord.js";

import {
  handleDiscordOperatorAutocomplete,
  handleOperatorAutocomplete,
  handleDiscordOperatorCommand,
  handleOperatorCommand,
  type OperatorCommandInput,
  type OperatorCommandOptions
} from "./operator-commands.js";
import type { OperatorHealthSnapshot } from "../app/operator-health.js";
import type { StoredPrediction } from "../storage/database.js";
import { WORLD_CUP_2026_SEED } from "../worldcup/seed.js";

describe("handleOperatorCommand", () => {
  test("post-today posts cards for the current local date", async () => {
    const postDueMatchCards = vi.fn(async () => ({ posted: ["wc2026-001"], skipped: [] }));

    const result = await handleOperatorCommand(
      command("post-today"),
      options({ postDueMatchCards })
    );

    expect(result).toEqual({
      action: "replied",
      content: "Posted 1 matchday card for 1 match on 2026-06-11. Skipped 0 already posted.",
      ephemeral: true
    });
    expect(postDueMatchCards).toHaveBeenCalledWith("2026-06-11", "command");
  });

  test("post-today uses the previous matchday before the local rollover time", async () => {
    const postDueMatchCards = vi.fn(async () => ({ posted: ["wc2026-008"], skipped: [] }));

    const result = await handleOperatorCommand(
      command("post-today"),
      options({
        postDueMatchCards,
        timeZone: "America/Sao_Paulo",
        matchdayRolloverTime: "06:00",
        now: () => new Date("2026-06-14T03:15:00.000Z")
      })
    );

    expect(result).toEqual({
      action: "replied",
      content: "Posted 1 matchday card for 1 match on 2026-06-13. Skipped 0 already posted.",
      ephemeral: true
    });
    expect(postDueMatchCards).toHaveBeenCalledWith("2026-06-13", "command");
  });

  test("post-date posts cards for the requested date", async () => {
    const postDueMatchCards = vi.fn(async () => ({ posted: [], skipped: ["wc2026-003"] }));

    const result = await handleOperatorCommand(
      command("post-date", { date: "2026-06-12" }),
      options({ postDueMatchCards })
    );

    expect(result).toEqual({
      action: "replied",
      content: "Posted 0 matchday cards for 0 matches on 2026-06-12. Skipped 1 already posted.",
      ephemeral: true
    });
    expect(postDueMatchCards).toHaveBeenCalledWith("2026-06-12", "command");
  });

  test("clear-posted-date resets posted card records for the requested date", async () => {
    const clearPostedMatchCards = vi.fn(() => 2);

    const result = await handleOperatorCommand(
      command("clear-posted-date", { date: "2026-06-11" }),
      options({ clearPostedMatchCards })
    );

    expect(result).toEqual({
      action: "replied",
      content: [
        "Cleared 2 posted match card records for 2026-06-11.",
        "Predictions, results, and standings were not touched."
      ].join("\n"),
      ephemeral: true
    });
    expect(clearPostedMatchCards).toHaveBeenCalledWith("2026-06-11");
  });

  test("reset-test-date clears posted cards, predictions, and results for the requested date", async () => {
    const clearPostedMatchCards = vi.fn(() => 2);
    const clearPredictionsForMatches = vi.fn(() => 3);
    const clearResultsForMatches = vi.fn(() => 1);
    const clearPredictionRevealPostsForMatches = vi.fn(() => 4);
    const clearMatchStartAlertsForMatches = vi.fn(() => 5);
    const updateStandingsDashboard = vi.fn(async () => ({ action: "updated" as const, posts: [] }));
    const updateLeaderboardDashboard = vi.fn(async () => ({
      action: "updated" as const,
      post: { messageId: "leaderboard-message-1", action: "edited" as const },
      renderState: "image" as const
    }));
    const updateBracketDashboard = vi.fn(async () => ({
      action: "updated" as const,
      post: { messageId: "bracket-message-1", action: "edited" as const },
      bracketPhase: "provisional" as const,
      renderState: "image" as const
    }));
    const updateThirdPlaceDashboard = vi.fn(async () => ({
      action: "updated" as const,
      post: { messageId: "third-place-message-1", action: "edited" as const },
      qualificationStatus: "resolved" as const,
      renderState: "image" as const
    }));
    const updateChaosDashboard = vi.fn(async () => ({
      action: "updated" as const,
      posted: [
        {
          periodKey: "group-week-1",
          messageId: "chaos-message-1",
          action: "edited" as const,
          renderState: "image" as const
        }
      ],
      skipped: []
    }));

    const result = await handleOperatorCommand(
      command("reset-test-date", { date: "2026-06-11" }),
      options({
        clearPostedMatchCards,
        clearPredictionsForMatches,
        clearResultsForMatches,
        clearPredictionRevealPostsForMatches,
        clearMatchStartAlertsForMatches,
        updateStandingsDashboard,
        updateLeaderboardDashboard,
        updateBracketDashboard,
        updateThirdPlaceDashboard,
        updateChaosDashboard
      })
    );

    expect(result).toEqual({
      action: "replied",
      content: [
        "Reset test data for 2026-06-11.",
        "Posted card records: 2",
        "Predictions: 3",
        "Results: 1",
        "Prediction reveals: 4",
        "Match start alerts: 5",
        "Standings refreshed.",
        "Leaderboard refreshed.",
        "Bracket refreshed.",
        "Third-place dashboard refreshed.",
        "Copanalhas Recap refreshed."
      ].join("\n"),
      ephemeral: true
    });
    expect(clearPostedMatchCards).toHaveBeenCalledWith("2026-06-11");
    expect(clearPredictionsForMatches).toHaveBeenCalledWith(["wc2026-001", "wc2026-002"]);
    expect(clearResultsForMatches).toHaveBeenCalledWith(["wc2026-001", "wc2026-002"]);
    expect(clearPredictionRevealPostsForMatches).toHaveBeenCalledWith([
      "wc2026-001",
      "wc2026-002"
    ]);
    expect(clearMatchStartAlertsForMatches).toHaveBeenCalledWith(["wc2026-001", "wc2026-002"]);
    expect(updateStandingsDashboard).toHaveBeenCalledOnce();
    expect(updateLeaderboardDashboard).toHaveBeenCalledOnce();
    expect(updateBracketDashboard).toHaveBeenCalledOnce();
    expect(updateThirdPlaceDashboard).toHaveBeenCalledOnce();
    expect(updateChaosDashboard).toHaveBeenCalledWith(false);
  });

  test("status reports today's automation state and recent catch-up results", async () => {
    await expect(
      handleOperatorCommand(
        command("status"),
        options({
          getOperatorHealth: () => operatorHealthSnapshot()
        })
      )
    ).resolves.toEqual({
      action: "replied",
      content: [
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
        "Dashboards: standings 1/2, leaderboard present, bracket present, third places present, recaps 2",
        "Last leaderboard update: 2026-06-11T18:00:00.000Z",
        "Last bracket update: 2026-06-11T18:05:00.000Z",
        "Last third-place update: 2026-06-11T18:07:00.000Z",
        "Last recap update: 2026-06-11T18:10:00.000Z",
        "Data: 104 matches loaded, 0 missing kickoff times"
      ].join("\n"),
      ephemeral: true
    });
  });

  test("standings posts or updates the standings dashboard", async () => {
    const updateStandingsDashboard = vi.fn(async () => ({
      action: "updated" as const,
      posts: [
        { postKey: "groups_a_f" as const, messageId: "message-a", action: "posted" as const, renderState: "image" as const },
        { postKey: "groups_g_l" as const, messageId: "message-b", action: "posted" as const, renderState: "image" as const }
      ]
    }));

    const result = await handleOperatorCommand(
      command("standings"),
      options({ updateStandingsDashboard })
    );

    expect(result).toEqual({
      action: "replied",
      content: "Updated standings dashboard: 2 posts.",
      ephemeral: true
    });
    expect(updateStandingsDashboard).toHaveBeenCalledOnce();
  });

  test("leaderboard returns formatted standings", async () => {
    const resolveUserDisplayNames = vi.fn(async (userIds: readonly string[]) => {
      expect(userIds).toEqual(["u1", "u2"]);

      return new Map([
        ["u1", "Alice"],
        ["u2", "Bob"]
      ]);
    });
    const result = await handleOperatorCommand(
      command("leaderboard"),
      options({
        listPredictions: () => [
          storedPrediction("u1", 2, 1, "2026-06-10T12:00:00.000Z"),
          storedPrediction("u2", 1, 1, "2026-06-10T12:00:00.000Z")
        ],
        listResults: () => [{ matchId: "wc2026-001", homeScore: 2, awayScore: 1 }],
        resolveUserDisplayNames
      })
    );

    expect(result).toEqual({
      action: "replied",
      content: expect.any(String),
      ephemeral: true
    });
    if (result.action !== "replied") {
      throw new Error("expected leaderboard reply");
    }
    expect(resolveUserDisplayNames).toHaveBeenCalledOnce();
    expect(result.content).toContain("Ranking Copanalhas");
    expect(result.content).toContain(
      "1. Alice - 5 pts (1 solo, 0 exatos, 0 resultados, 0 mais próximos, 0 bônus, 1 partida)"
    );
    expect(result.content).toContain(
      "2. Bob - 0 pts (0 solos, 0 exatos, 0 resultados, 0 mais próximos, 0 bônus, 1 partida)"
    );
    expect(result.content).toContain("Como funciona");
  });

  test("bracket posts or updates the bracket dashboard", async () => {
    const updateBracketDashboard = vi.fn(async () => ({
      action: "updated" as const,
      post: { messageId: "bracket-message-1", action: "edited" as const },
      bracketPhase: "provisional" as const,
      renderState: "image" as const
    }));

    const result = await handleOperatorCommand(
      command("bracket"),
      options({ updateBracketDashboard })
    );

    expect(result).toEqual({
      action: "replied",
      content: "Updated bracket dashboard: edited (provisional, image).",
      ephemeral: true
    });
    expect(updateBracketDashboard).toHaveBeenCalledOnce();
  });

  test("bracket returns a private failure reply when refresh fails", async () => {
    const result = await handleOperatorCommand(
      command("bracket"),
      options({
        updateBracketDashboard: vi.fn(async () => {
          throw new Error("Discord upload failed");
        })
      })
    );

    expect(result).toEqual({
      action: "replied",
      content: "Failed to update bracket dashboard: Discord upload failed.",
      ephemeral: true
    });
  });

  test("third-places posts or updates the third-place dashboard", async () => {
    const updateThirdPlaceDashboard = vi.fn(async () => ({
      action: "updated" as const,
      post: { messageId: "third-place-message-1", action: "edited" as const },
      qualificationStatus: "resolved" as const,
      renderState: "image" as const
    }));

    const result = await handleOperatorCommand(
      command("third-places"),
      options({ updateThirdPlaceDashboard })
    );

    expect(result).toEqual({
      action: "replied",
      content: "Updated third-place dashboard: edited (resolved, image).",
      ephemeral: true
    });
    expect(updateThirdPlaceDashboard).toHaveBeenCalledOnce();
  });

  test("third-places returns a private failure reply when refresh fails", async () => {
    const result = await handleOperatorCommand(
      command("third-places"),
      options({
        updateThirdPlaceDashboard: vi.fn(async () => {
          throw new Error("Discord upload failed");
        })
      })
    );

    expect(result).toEqual({
      action: "replied",
      content: "Failed to update third-place dashboard: Discord upload failed.",
      ephemeral: true
    });
  });

  test("copanalhas-recap-painel posts or updates the chaos dashboard", async () => {
    const updateChaosDashboard = vi.fn(async () => ({
      action: "updated" as const,
      posted: [
        {
          periodKey: "group-week-1",
          messageId: "chaos-message-1",
          action: "posted" as const,
          renderState: "image" as const
        },
        {
          periodKey: "group-week-2",
          messageId: "chaos-message-2",
          action: "edited" as const,
          renderState: "image" as const
        }
      ],
      skipped: [{ periodKey: "group-week-3", reason: "incomplete" as const }]
    }));

    const result = await handleOperatorCommand(
      command("copanalhas-recap-painel"),
      options({ updateChaosDashboard })
    );

    expect(result).toEqual({
      action: "replied",
      content:
        "Updated Copanalhas Recap: 2 recaps updated posted=1 edited=1 replaced=0 incomplete=1 alreadyPosted=0.",
      ephemeral: true
    });
    expect(updateChaosDashboard).toHaveBeenCalledWith();
  });

  test("copanalhas-recap-painel can target one recap period", async () => {
    const updateChaosDashboard = vi.fn(async () => ({
      action: "updated" as const,
      posted: [
        {
          periodKey: "group-week-2",
          messageId: "chaos-message-2",
          action: "edited" as const,
          renderState: "image" as const
        }
      ],
      skipped: []
    }));

    const result = await handleOperatorCommand(
      command("copanalhas-recap-painel", { period: "group-week-2" }),
      options({ updateChaosDashboard })
    );

    expect(result).toEqual({
      action: "replied",
      content:
        "Updated Copanalhas Recap (Fase de grupos - semana 2): 1 recaps updated posted=0 edited=1 replaced=0 incomplete=0 alreadyPosted=0.",
      ephemeral: true
    });
    expect(updateChaosDashboard).toHaveBeenCalledWith(true, "group-week-2");
  });

  test("copanalhas-recap-painel rejects unknown recap periods", async () => {
    const updateChaosDashboard = vi.fn();

    const result = await handleOperatorCommand(
      command("copanalhas-recap-painel", { period: "unknown-week" }),
      options({ updateChaosDashboard })
    );

    expect(result).toEqual({
      action: "replied",
      content:
        "Unknown Copanalhas Recap period unknown-week. Use group-week-1, group-week-2, or group-week-3.",
      ephemeral: true
    });
    expect(updateChaosDashboard).not.toHaveBeenCalled();
  });

  test("copanalhas-recap-painel returns a private failure reply when refresh fails", async () => {
    const result = await handleOperatorCommand(
      command("copanalhas-recap-painel"),
      options({
        updateChaosDashboard: vi.fn(async () => {
          throw new Error("Discord upload failed");
        })
      })
    );

    expect(result).toEqual({
      action: "replied",
      content: "Failed to update Copanalhas Recap: Discord upload failed.",
      ephemeral: true
    });
  });

  test("sync-results forces an immediate provider result sync", async () => {
    const syncResultsNow = vi.fn(async () => ({
      action: "synced" as const,
      dateFrom: "2026-06-11",
      dateTo: "2026-06-11",
      storedResults: ["wc2026-001"],
      skipped: ["wc2026-002"]
    }));

    const result = await handleOperatorCommand(
      command("sync-results"),
      options({
        resultSyncEnabled: true,
        syncResultsNow
      })
    );

    expect(result).toEqual({
      action: "replied",
      content: "Synced results now: stored 1, skipped 1 (2026-06-11 to 2026-06-11).",
      ephemeral: true
    });
    expect(syncResultsNow).toHaveBeenCalledOnce();
  });

  test("meus-palpites returns the caller's predictions for the current local date", async () => {
    const result = await handleOperatorCommand(
      command("meus-palpites"),
      options({
        listPredictions: () => [storedPrediction("operator-1", 2, 1, "2026-06-10T12:00:00.000Z")]
      })
    );

    expect(result).toEqual({
      action: "replied",
      content: [
        "Meus palpites - 2026-06-11",
        "#1 México x África do Sul: 2x1",
        "#2 Coreia do Sul x Tchéquia: sem palpite"
      ].join("\n"),
      ephemeral: true
    });
  });

  test("meus-palpites can inspect another date without returning the whole tournament", async () => {
    const result = await handleOperatorCommand(
      command("meus-palpites", { date: "2026-06-12" }),
      options({
        listPredictions: () => [
          { ...storedPrediction("operator-1", 1, 1, "2026-06-10T12:00:00.000Z"), matchId: "wc2026-003" }
        ]
      })
    );

    expect(result).toEqual({
      action: "replied",
      content: [
        "Meus palpites - 2026-06-12",
        "#3 Canadá x Bósnia e Herzegovina: 1x1",
        "#4 Estados Unidos x Paraguai: sem palpite"
      ].join("\n"),
      ephemeral: true
    });
  });

  test("predictions returns a private operator audit for one match", async () => {
    const result = await handleOperatorCommand(
      command("predictions", { match: "wc2026-001" }),
      options({
        listPredictions: () => [storedPrediction("user-1", 2, 1, "2026-06-10T12:00:00.000Z")],
        now: () => new Date("2026-06-10T13:00:00.000Z")
      })
    );

    expect(result).toEqual({
      action: "replied",
      content: [
        "Prediction Audit",
        "Match #1 - México vs África do Sul",
        "Window: open, closes <t:1781202600:R>",
        "",
        "1 submitted",
        "<@user-1>  2x1  submitted <t:1781092800:R>"
      ].join("\n"),
      ephemeral: true
    });
  });

  test("reveal refuses to publicly show picks before predictions close", async () => {
    const result = await handleOperatorCommand(
      command("reveal", { match: "wc2026-001" }),
      options({
        listPredictions: () => [storedPrediction("user-1", 2, 1, "2026-06-10T12:00:00.000Z")],
        now: () => new Date("2026-06-10T13:00:00.000Z")
      })
    );

    expect(result).toEqual({
      action: "replied",
      content: [
        "Predictions are still open for Match #1 - México vs África do Sul.",
        "Public reveal unlocks when predictions close: <t:1781202600:F> (<t:1781202600:R>)."
      ].join("\n"),
      ephemeral: true
    });
  });

  test("reveal returns a public pick list after predictions close", async () => {
    const result = await handleOperatorCommand(
      command("reveal", { match: "wc2026-001" }),
      options({
        listPredictions: () => [storedPrediction("user-1", 2, 1, "2026-06-10T12:00:00.000Z")],
        now: () => new Date("2026-06-11T18:30:00.000Z")
      })
    );

    expect(result).toEqual({
      action: "replied",
      content: [
        "Picks are locked for Match #1",
        "México vs África do Sul",
        "",
        "1 submitted",
        "<@user-1>  2x1"
      ].join("\n"),
      ephemeral: false
    });
  });

  test("repost-reveal clears stale reveal state and reposts locked predictions", async () => {
    const repostPredictionReveal = vi.fn(async () => ({
      cleared: 1,
      repostedMatchIds: ["wc2026-001"],
      posted: [
        {
          matchIds: ["wc2026-001"],
          threadId: "thread-2",
          messageId: "reveal-message-2"
        }
      ],
      skipped: []
    }));

    const result = await handleOperatorCommand(
      command("repost-reveal", { match: "wc2026-001" }),
      options({ repostPredictionReveal })
    );

    expect(result).toEqual({
      action: "replied",
      content: [
        "Reposted prediction reveal for #1 México x África do Sul.",
        "Cleared reveal records: 1",
        "Reposted matches: wc2026-001"
      ].join("\n"),
      ephemeral: true
    });
    expect(repostPredictionReveal).toHaveBeenCalledWith("wc2026-001");
  });

  test("result records a manual result for a known match", async () => {
    const upsertResult = vi.fn();

    const result = await handleOperatorCommand(
      command("result", { match: "wc2026-001", score: "2-1" }),
      options({ upsertResult })
    );

    expect(result).toEqual({
      action: "replied",
      content: "Recorded result wc2026-001 2-1.",
      ephemeral: true
    });
    expect(upsertResult).toHaveBeenCalledWith({
      matchId: "wc2026-001",
      homeScore: 2,
      awayScore: 1,
      recordedAt: "2026-06-11T23:00:00.000Z",
      resultSource: "manual",
      externalMatchId: null,
      fetchedAt: null
    });
  });

  test("result records detailed knockout manual result fields", async () => {
    const upsertResult = vi.fn();

    const result = await handleOperatorCommand(
      command("result", {
        match: "wc2026-073",
        score: "5-4",
        decision: "penalties",
        "regular-score": "1-1",
        "extra-score": "1-1",
        "penalties-score": "4-3",
        winner: "home"
      }),
      options({ upsertResult })
    );

    expect(result).toEqual({
      action: "replied",
      content: "Recorded result wc2026-073 5-4.",
      ephemeral: true
    });
    expect(upsertResult).toHaveBeenCalledWith({
      matchId: "wc2026-073",
      homeScore: 5,
      awayScore: 4,
      decisionMethod: "penalties",
      regularTimeHomeScore: 1,
      regularTimeAwayScore: 1,
      extraTimeHomeScore: 1,
      extraTimeAwayScore: 1,
      penaltyHomeScore: 4,
      penaltyAwayScore: 3,
      winner: "home",
      recordedAt: "2026-06-11T23:00:00.000Z",
      resultSource: "manual",
      externalMatchId: null,
      fetchedAt: null
    });
  });

  test("result refreshes standings and leaderboard after recording a manual result", async () => {
    const updateStandingsDashboard = vi.fn(async () => ({
      action: "updated" as const,
      posts: [
        { postKey: "groups_a_f" as const, messageId: "message-a", action: "edited" as const, renderState: "image" as const },
        { postKey: "groups_g_l" as const, messageId: "message-b", action: "edited" as const, renderState: "image" as const }
      ]
    }));
    const updateLeaderboardDashboard = vi.fn(async () => ({
      action: "updated" as const,
      post: { messageId: "leaderboard-message-1", action: "edited" as const },
      renderState: "image" as const
    }));
    const updatePredictionResultReveals = vi.fn(async () => undefined);
    const updateBracketDashboard = vi.fn(async () => ({
      action: "updated" as const,
      post: { messageId: "bracket-message-1", action: "edited" as const },
      bracketPhase: "provisional" as const,
      renderState: "image" as const
    }));
    const updateThirdPlaceDashboard = vi.fn(async () => ({
      action: "updated" as const,
      post: { messageId: "third-place-message-1", action: "edited" as const },
      qualificationStatus: "resolved" as const,
      renderState: "image" as const
    }));

    await handleOperatorCommand(
      command("result", { match: "wc2026-001", score: "2-1" }),
      options({
        updateStandingsDashboard,
        updateLeaderboardDashboard,
        updateBracketDashboard,
        updateThirdPlaceDashboard,
        updatePredictionResultReveals
      })
    );

    expect(updateStandingsDashboard).toHaveBeenCalledOnce();
    expect(updateLeaderboardDashboard).toHaveBeenCalledOnce();
    expect(updateBracketDashboard).toHaveBeenCalledOnce();
    expect(updateThirdPlaceDashboard).toHaveBeenCalledOnce();
    expect(updatePredictionResultReveals).toHaveBeenCalledOnce();
  });

  test("ignores commands outside the configured guild", async () => {
    await expect(handleOperatorCommand(command("status", {}, { guildId: "other" }), options()))
      .resolves.toEqual({ action: "ignored", reason: "wrong-guild" });
  });
});

describe("handleOperatorAutocomplete", () => {
  test("returns filtered match choices for match options", () => {
    const result = handleOperatorAutocomplete(
      {
        guildId: "guild-1",
        channelId: "channel-1",
        userId: "operator-1",
        subcommand: "predictions",
        focusedOptionName: "match",
        focusedValue: "mex"
      },
      options()
    );

    expect(result).toEqual({
      action: "responded",
      choices: [
        {
          name: "#1 · México x África do Sul · 2026-06-11 13:00",
          value: "wc2026-001"
        },
        {
          name: "#28 · México x Coreia do Sul · 2026-06-18 19:00",
          value: "wc2026-028"
        },
        {
          name: "#53 · Tchéquia x México · 2026-06-24 19:00",
          value: "wc2026-053"
        }
      ]
    });
  });

  test("limits autocomplete choices to Discord's maximum of 25", () => {
    const result = handleOperatorAutocomplete(
      {
        guildId: "guild-1",
        channelId: "channel-1",
        userId: "operator-1",
        subcommand: "result",
        focusedOptionName: "match",
        focusedValue: ""
      },
      options()
    );

    if (result.action !== "responded") {
      throw new Error("expected autocomplete choices");
    }
    expect(result.choices).toHaveLength(25);
  });

  test("returns match choices for repost-reveal", () => {
    const result = handleOperatorAutocomplete(
      {
        guildId: "guild-1",
        channelId: "channel-1",
        userId: "operator-1",
        subcommand: "repost-reveal",
        focusedOptionName: "match",
        focusedValue: "mex"
      },
      options()
    );

    expect(result).toEqual({
      action: "responded",
      choices: [
        {
          name: "#1 · México x África do Sul · 2026-06-11 13:00",
          value: "wc2026-001"
        },
        {
          name: "#28 · México x Coreia do Sul · 2026-06-18 19:00",
          value: "wc2026-028"
        },
        {
          name: "#53 · Tchéquia x México · 2026-06-24 19:00",
          value: "wc2026-053"
        }
      ]
    });
  });
});

describe("handleDiscordOperatorAutocomplete", () => {
  test("logs mapped Discord autocomplete outcomes", async () => {
    const logOperatorAutocomplete = vi.fn();
    const interaction = discordAutocompleteInteraction();

    const result = await handleDiscordOperatorAutocomplete(
      interaction as unknown as Interaction,
      options({ logOperatorAutocomplete })
    );

    expect(result.action).toBe("responded");
    expect(logOperatorAutocomplete).toHaveBeenCalledWith(
      {
        guildId: "guild-1",
        channelId: "channel-1",
        userId: "operator-1",
        subcommand: "predictions",
        focusedOptionName: "match",
        focusedValue: "mex"
      },
      expect.objectContaining({
        action: "responded"
      })
    );
  });
});

describe("handleDiscordOperatorCommand", () => {
  test("maps private Discord chat input commands to deferred ephemeral replies", async () => {
    const interaction = discordCommandInteraction("status");

    const result = await handleDiscordOperatorCommand(
      interaction as unknown as Interaction,
      options()
    );

    expect(result.action).toBe("replied");
    expect(interaction.deferReply).toHaveBeenCalledWith({
      flags: MessageFlags.Ephemeral
    });
    expect(interaction.editReply).toHaveBeenCalledWith({
      content: expect.stringContaining("Copanalhas Status"),
      allowedMentions: { parse: [] }
    });
    expect(interaction.reply).not.toHaveBeenCalled();
  });

  test("logs mapped Discord operator command outcomes", async () => {
    const logOperatorCommand = vi.fn();
    const interaction = discordCommandInteraction("result");

    const result = await handleDiscordOperatorCommand(
      interaction as unknown as Interaction,
      options({ logOperatorCommand })
    );

    expect(result.action).toBe("replied");
    expect(logOperatorCommand).toHaveBeenCalledWith(
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
      expect.objectContaining({
        action: "replied",
        ephemeral: true
      })
    );
  });

  test("defers private operator commands before running slow work", async () => {
    const events: string[] = [];
    const interaction = discordCommandInteraction("post-date", events);
    const postDueMatchCards = vi.fn(async () => {
      events.push("work");
      return { posted: ["wc2026-001"], skipped: [] };
    });

    await handleDiscordOperatorCommand(
      interaction as unknown as Interaction,
      options({ postDueMatchCards })
    );

    expect(events).toEqual(["defer", "work", "edit"]);
    expect(interaction.deferReply).toHaveBeenCalledWith({
      flags: MessageFlags.Ephemeral
    });
    expect(interaction.editReply).toHaveBeenCalledWith({
      content: "Posted 1 matchday card for 1 match on 2026-06-11. Skipped 0 already posted.",
      allowedMentions: { parse: [] }
    });
    expect(interaction.reply).not.toHaveBeenCalled();
  });

  test("ignores stale private operator interactions without running command work", async () => {
    const logOperatorCommand = vi.fn();
    const interaction = discordCommandInteraction("post-date");
    const staleInteractionError = Object.assign(new Error("Unknown interaction"), {
      code: 10062,
      status: 404
    });
    interaction.deferReply.mockRejectedValueOnce(staleInteractionError);
    const postDueMatchCards = vi.fn(async () => {
      throw new Error("must not run command work after a stale interaction");
    });

    const result = await handleDiscordOperatorCommand(
      interaction as unknown as Interaction,
      options({ logOperatorCommand, postDueMatchCards })
    );

    expect(result).toEqual({ action: "ignored", reason: "stale-interaction" });
    expect(postDueMatchCards).not.toHaveBeenCalled();
    expect(interaction.editReply).not.toHaveBeenCalled();
    expect(interaction.reply).not.toHaveBeenCalled();
    expect(logOperatorCommand).toHaveBeenCalledWith(
      {
        guildId: "guild-1",
        channelId: "channel-1",
        userId: "operator-1",
        subcommand: "post-date",
        options: { date: "2026-06-11" }
      },
      { action: "ignored", reason: "stale-interaction" }
    );
  });

  test("maps sync-results through a private deferred reply", async () => {
    const events: string[] = [];
    const interaction = discordCommandInteraction("sync-results", events);

    await handleDiscordOperatorCommand(
      interaction as unknown as Interaction,
      options({
        resultSyncEnabled: true,
        syncResultsNow: vi.fn(async () => ({
          action: "synced" as const,
          dateFrom: "2026-06-11",
          dateTo: "2026-06-11",
          storedResults: ["wc2026-001"],
          skipped: []
        }))
      })
    );

    expect(events).toEqual(["defer", "edit"]);
    expect(interaction.deferReply).toHaveBeenCalledWith({
      flags: MessageFlags.Ephemeral
    });
    expect(interaction.editReply).toHaveBeenCalledWith({
      content: "Synced results now: stored 1, skipped 0 (2026-06-11 to 2026-06-11).",
      allowedMentions: { parse: [] }
    });
    expect(interaction.reply).not.toHaveBeenCalled();
  });

  test("maps public operator replies without the ephemeral flag", async () => {
    const interaction = discordCommandInteraction("reveal");

    await handleDiscordOperatorCommand(
      interaction as unknown as Interaction,
      options({
        listPredictions: () => [storedPrediction("user-1", 2, 1, "2026-06-10T12:00:00.000Z")],
        now: () => new Date("2026-06-11T18:30:00.000Z")
      })
    );

    expect(interaction.deferReply).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledWith({
      content: expect.stringContaining("Picks are locked"),
      allowedMentions: { parse: [] }
    });
  });
});

function command(
  subcommand:
    | OperatorCommandInput["subcommand"]
    | "predictions"
    | "reveal"
    | "repost-reveal"
    | "bracket"
    | "copanalhas-recap-painel",
  commandOptions: Record<string, string> = {},
  overrides: Partial<OperatorCommandInput> = {}
): OperatorCommandInput {
  return {
    guildId: "guild-1",
    channelId: "channel-1",
    userId: "operator-1",
    subcommand: subcommand as OperatorCommandInput["subcommand"],
    options: commandOptions,
    ...overrides
  };
}

function options(overrides: Partial<OperatorCommandOptions> = {}): OperatorCommandOptions {
  return {
    guildId: "guild-1",
    channelId: "channel-1",
    matches: WORLD_CUP_2026_SEED.matches,
    timeZone: "UTC",
    matchdayRolloverTime: "06:00",
    resultSyncEnabled: false,
    now: () => new Date("2026-06-11T23:00:00.000Z"),
    postDueMatchCards: vi.fn(async () => ({ posted: [], skipped: [] })),
    clearPostedMatchCards: vi.fn(() => 0),
    clearPredictionsForMatches: vi.fn(() => 0),
    clearResultsForMatches: vi.fn(() => 0),
    clearPredictionRevealPostsForMatches: vi.fn(() => 0),
    clearMatchStartAlertsForMatches: vi.fn(() => 0),
    listPredictions: vi.fn(() => []),
    listResults: vi.fn(() => []),
    upsertResult: vi.fn(),
    listStandingsPosts: vi.fn(() => []),
    updateStandingsDashboard: vi.fn(async () => ({ action: "updated" as const, posts: [] })),
    listLeaderboardPosts: vi.fn(() => []),
    updateLeaderboardDashboard: vi.fn(async () => ({
      action: "updated" as const,
      post: { messageId: "leaderboard-message-1", action: "edited" as const },
      renderState: "image" as const
    })),
    listBracketPosts: vi.fn(() => []),
    updateBracketDashboard: vi.fn(async () => ({
      action: "updated" as const,
      post: { messageId: "bracket-message-1", action: "edited" as const },
      bracketPhase: "provisional" as const,
      renderState: "image" as const
    })),
    listThirdPlacePosts: vi.fn(() => []),
    updateThirdPlaceDashboard: vi.fn(async () => ({
      action: "updated" as const,
      post: { messageId: "third-place-message-1", action: "edited" as const },
      qualificationStatus: "resolved" as const,
      renderState: "image" as const
    })),
    listChaosDashboardPosts: vi.fn(() => []),
    updateChaosDashboard: vi.fn(async () => ({
      action: "updated" as const,
      posted: [],
      skipped: []
    })),
    syncResultsNow: vi.fn(async () => ({
      action: "disabled" as const,
      reason: "disabled" as const
    })),
    repostPredictionReveal: vi.fn(async () => ({
      cleared: 0,
      repostedMatchIds: [],
      posted: [],
      skipped: []
    })),
    ...overrides
  };
}

function discordCommandInteraction(
  subcommand:
    | OperatorCommandInput["subcommand"]
    | "predictions"
    | "reveal"
    | "repost-reveal"
    | "bracket"
    | "copanalhas-recap-painel",
  events: string[] = []
) {
  return {
    isChatInputCommand: () => true,
    commandName: "copanalhas",
    guildId: "guild-1",
    channelId: "channel-1",
    user: {
      id: "operator-1"
    },
    options: {
      getSubcommand: vi.fn(() => subcommand),
      getString: vi.fn((name: string) => {
        if (name === "date") {
          return "2026-06-11";
        }

        if (name === "match") {
          return "wc2026-001";
        }

        if (name === "score") {
          return "2-1";
        }

        return null;
      })
    },
    deferReply: vi.fn(async () => {
      events.push("defer");
    }),
    editReply: vi.fn(async () => {
      events.push("edit");
    }),
    reply: vi.fn(async () => {
      events.push("reply");
    })
  };
}

function discordAutocompleteInteraction() {
  return {
    isAutocomplete: () => true,
    commandName: "copanalhas",
    guildId: "guild-1",
    channelId: "channel-1",
    user: {
      id: "operator-1"
    },
    options: {
      getSubcommand: vi.fn(() => "predictions"),
      getFocused: vi.fn(() => ({
        name: "match",
        value: "mex"
      }))
    },
    respond: vi.fn(async () => undefined)
  };
}

function storedPrediction(
  userId: string,
  homeScore: number,
  awayScore: number,
  submittedAt: string
): StoredPrediction {
  return {
    userId,
    matchId: "wc2026-001",
    messageId: `interaction-${userId}`,
    homeScore,
    awayScore,
    submittedAt,
    updatedAt: null,
    parserVersion: "prediction-modal-v1"
  };
}

function operatorHealthSnapshot(): OperatorHealthSnapshot {
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
    bracketPost: {
      present: true,
      lastUpdatedAt: "2026-06-11T18:05:00.000Z"
    },
    thirdPlacePost: {
      present: true,
      lastUpdatedAt: "2026-06-11T18:07:00.000Z"
    },
    chaosDashboardPost: {
      present: true,
      count: 2,
      periodKeys: ["group-week-1", "group-week-2"],
      lastUpdatedAt: "2026-06-11T18:10:00.000Z"
    },
    data: {
      matchesLoaded: 104,
      missingKickoffTimes: 0
    }
  };
}
