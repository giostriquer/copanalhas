import { describe, expect, test, vi } from "vitest";
import { MessageFlags, type Interaction } from "discord.js";

import {
  handleDiscordOperatorCommand,
  handleOperatorCommand,
  type OperatorCommandInput,
  type OperatorCommandOptions
} from "./operator-commands.js";
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
        "Matches loaded: 12",
        "Missing kickoff times: 12",
        "Result sync: off"
      ].join("\n"),
      ephemeral: true
    });
  });

  test("leaderboard returns formatted standings", async () => {
    await expect(
      handleOperatorCommand(
        command("leaderboard"),
        options({
          listPredictions: () => [
            { userId: "u1", matchId: "wc2026-001", homeScore: 2, awayScore: 1 },
            { userId: "u2", matchId: "wc2026-001", homeScore: 1, awayScore: 1 }
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

  test("ignores commands outside the configured guild", async () => {
    await expect(handleOperatorCommand(command("status", {}, { guildId: "other" }), options()))
      .resolves.toEqual({ action: "ignored", reason: "wrong-guild" });
  });
});

describe("handleDiscordOperatorCommand", () => {
  test("maps Discord chat input commands to ephemeral operator replies", async () => {
    const interaction = discordCommandInteraction("status");

    const result = await handleDiscordOperatorCommand(
      interaction as unknown as Interaction,
      options()
    );

    expect(result.action).toBe("replied");
    expect(interaction.reply).toHaveBeenCalledWith({
      content: expect.stringContaining("Copanalhas Status"),
      flags: MessageFlags.Ephemeral
    });
  });
});

function command(
  subcommand: OperatorCommandInput["subcommand"],
  commandOptions: Record<string, string> = {},
  overrides: Partial<OperatorCommandInput> = {}
): OperatorCommandInput {
  return {
    guildId: "guild-1",
    channelId: "channel-1",
    userId: "operator-1",
    subcommand,
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
    ...overrides
  };
}

function discordCommandInteraction(subcommand: OperatorCommandInput["subcommand"]) {
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
    reply: vi.fn(async () => undefined)
  };
}
