import { describe, expect, test, vi } from "vitest";
import { MessageFlags, type Interaction } from "discord.js";

import {
  handleDiscordOperatorCommand,
  handleOperatorCommand,
  type OperatorCommandInput,
  type OperatorCommandOptions
} from "./operator-commands.js";
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
      content: "Posted 1 match card for 2026-06-11. Skipped 0 already posted.",
      ephemeral: true
    });
    expect(postDueMatchCards).toHaveBeenCalledWith("2026-06-11", "command");
  });

  test("post-date posts cards for the requested date", async () => {
    const postDueMatchCards = vi.fn(async () => ({ posted: [], skipped: ["wc2026-003"] }));

    const result = await handleOperatorCommand(
      command("post-date", { date: "2026-06-12" }),
      options({ postDueMatchCards })
    );

    expect(result).toEqual({
      action: "replied",
      content: "Posted 0 match cards for 2026-06-12. Skipped 1 already posted.",
      ephemeral: true
    });
    expect(postDueMatchCards).toHaveBeenCalledWith("2026-06-12", "command");
  });

  test("status reports missing kickoff times and result sync state", async () => {
    await expect(handleOperatorCommand(command("status"), options())).resolves.toEqual({
      action: "replied",
      content: [
        "Copanalhas Status",
        "Matches loaded: 72",
        "Missing kickoff times: 0",
        "Result sync: off",
        "Standings posts: 0/2",
        "Standings last updated: never"
      ].join("\n"),
      ephemeral: true
    });
  });

  test("standings posts or updates the standings dashboard", async () => {
    const updateStandingsDashboard = vi.fn(async () => ({
      action: "updated" as const,
      posts: [
        { postKey: "groups_a_f" as const, messageId: "message-a", action: "posted" as const },
        { postKey: "groups_g_l" as const, messageId: "message-b", action: "posted" as const }
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
    await expect(
      handleOperatorCommand(
        command("leaderboard"),
        options({
          listPredictions: () => [
            storedPrediction("u1", 2, 1, "2026-06-10T12:00:00.000Z"),
            storedPrediction("u2", 1, 1, "2026-06-10T12:00:00.000Z")
          ],
          listResults: () => [{ matchId: "wc2026-001", homeScore: 2, awayScore: 1 }]
        })
      )
    ).resolves.toEqual({
      action: "replied",
      content: [
        "Copanalhas Leaderboard",
        "1. u1 - 3 pts (1 exact, 0 closest, 1 match)",
        "2. u2 - 1 pt (0 exact, 1 closest, 1 match)"
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

  test("result refreshes standings after recording a manual result", async () => {
    const updateStandingsDashboard = vi.fn(async () => ({
      action: "updated" as const,
      posts: [
        { postKey: "groups_a_f" as const, messageId: "message-a", action: "edited" as const },
        { postKey: "groups_g_l" as const, messageId: "message-b", action: "edited" as const }
      ]
    }));

    await handleOperatorCommand(
      command("result", { match: "wc2026-001", score: "2-1" }),
      options({ updateStandingsDashboard })
    );

    expect(updateStandingsDashboard).toHaveBeenCalledOnce();
  });

  test("ignores commands outside the configured guild", async () => {
    await expect(handleOperatorCommand(command("status", {}, { guildId: "other" }), options()))
      .resolves.toEqual({ action: "ignored", reason: "wrong-guild" });
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
      content: "Posted 1 match card for 2026-06-11. Skipped 0 already posted.",
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
  subcommand: OperatorCommandInput["subcommand"] | "predictions" | "reveal",
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
    resultSyncEnabled: false,
    now: () => new Date("2026-06-11T23:00:00.000Z"),
    postDueMatchCards: vi.fn(async () => ({ posted: [], skipped: [] })),
    listPredictions: vi.fn(() => []),
    listResults: vi.fn(() => []),
    upsertResult: vi.fn(),
    listStandingsPosts: vi.fn(() => []),
    updateStandingsDashboard: vi.fn(async () => ({ action: "updated" as const, posts: [] })),
    ...overrides
  };
}

function discordCommandInteraction(
  subcommand: OperatorCommandInput["subcommand"] | "predictions" | "reveal",
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
