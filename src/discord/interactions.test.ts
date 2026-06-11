import { describe, expect, test, vi } from "vitest";
import { MessageFlags, type Interaction } from "discord.js";

import {
  handleDiscordPredictionInteraction,
  handlePredictionInteraction,
  modalPredictionParserVersion,
  type PredictionInteraction
} from "./interactions.js";
import {
  awayScoreInputCustomId,
  buildPredictButtonCustomId,
  buildScoreModalCustomId,
  homeScoreInputCustomId
} from "./components.js";
import type { StoredPrediction } from "../storage/database.js";
import { WORLD_CUP_2026_SEED } from "../worldcup/seed.js";
import type { WorldCupMatch } from "../worldcup/types.js";

describe("handlePredictionInteraction", () => {
  test("opens a score modal when a member clicks a match Predict button", async () => {
    const interaction = buttonInteraction({
      customId: buildPredictButtonCustomId("wc2026-001")
    });

    const result = await handlePredictionInteraction(interaction, options());

    expect(result).toEqual({ action: "opened-modal", matchId: "wc2026-001" });
    const showModal = vi.mocked(interaction.showModal);
    expect(showModal).toHaveBeenCalledOnce();
    expect(showModal.mock.calls[0]?.[0].toJSON()).toMatchObject({
      custom_id: "copanalhas:score:wc2026-001",
      title: "México x África do Sul"
    });
    expect(interaction.reply).not.toHaveBeenCalled();
  });

  test("opens a pre-filled score modal when the member already has a prediction", async () => {
    const interaction = buttonInteraction({
      customId: buildPredictButtonCustomId("wc2026-001")
    });

    await handlePredictionInteraction(
      interaction,
      options({
        listPredictions: () => [
          storedPrediction({
            userId: "user-1",
            homeScore: 2,
            awayScore: 1
          })
        ]
      })
    );

    const modal = vi.mocked(interaction.showModal).mock.calls[0]?.[0].toJSON();
    const firstRow = modal?.components[0] as { components: Array<{ value?: string }> } | undefined;
    const secondRow = modal?.components[1] as { components: Array<{ value?: string }> } | undefined;

    expect(firstRow?.components[0]?.value).toBe("2");
    expect(secondRow?.components[0]?.value).toBe("1");
  });

  test("stores a modal score prediction and replies privately", async () => {
    const storedPredictions: StoredPrediction[] = [];
    const interaction = modalInteraction({
      customId: buildScoreModalCustomId("wc2026-001"),
      homeScoreText: "2",
      awayScoreText: "1"
    });

    const result = await handlePredictionInteraction(
      interaction,
      options({
        upsertPrediction: (prediction) => {
          storedPredictions.push(prediction);
        }
      })
    );

    expect(result).toEqual({
      action: "accepted",
      prediction: {
        userId: "user-1",
        matchId: "wc2026-001",
        messageId: "interaction-1",
        homeScore: 2,
        awayScore: 1,
        submittedAt: "2026-06-10T12:00:00.000Z",
        updatedAt: null,
        parserVersion: modalPredictionParserVersion
      }
    });
    if (result.action !== "accepted") {
      throw new Error("expected accepted modal prediction");
    }
    expect(storedPredictions).toEqual([result.prediction]);
    expect(interaction.reply).toHaveBeenCalledWith({
      content: [
        "Palpite salvo: México 2-1 África do Sul",
        "",
        "Meus palpites - 2026-06-11",
        "#1 México x África do Sul: 2x1"
      ].join("\n"),
      ephemeral: true
    });
  });

  test("updates an existing modal score prediction without losing the original submission time", async () => {
    const storedPredictions: StoredPrediction[] = [];
    const interaction = modalInteraction({
      customId: buildScoreModalCustomId("wc2026-001"),
      homeScoreText: "3",
      awayScoreText: "1",
      createdAt: new Date("2026-06-10T12:30:00.000Z")
    });

    const result = await handlePredictionInteraction(
      interaction,
      options({
        listPredictions: () => [
          storedPrediction({
            submittedAt: "2026-06-10T12:00:00.000Z",
            homeScore: 2,
            awayScore: 1
          })
        ],
        upsertPrediction: (prediction) => {
          storedPredictions.push(prediction);
        }
      })
    );

    expect(result).toEqual({
      action: "accepted",
      prediction: {
        userId: "user-1",
        matchId: "wc2026-001",
        messageId: "interaction-1",
        homeScore: 3,
        awayScore: 1,
        submittedAt: "2026-06-10T12:00:00.000Z",
        updatedAt: "2026-06-10T12:30:00.000Z",
        parserVersion: modalPredictionParserVersion
      }
    });
    if (result.action !== "accepted") {
      throw new Error("expected accepted modal prediction");
    }
    expect(storedPredictions).toEqual([result.prediction]);
  });

  test("refreshes the leaderboard after accepting a modal score prediction", async () => {
    const events: string[] = [];
    const refreshLeaderboardAfterPrediction = vi.fn(async () => {
      events.push("refresh");
    });
    const interaction = modalInteraction({
      customId: buildScoreModalCustomId("wc2026-001"),
      homeScoreText: "2",
      awayScoreText: "1",
      reply: vi.fn(async () => {
        events.push("reply");
      })
    });

    await handlePredictionInteraction(
      interaction,
      options({
        upsertPrediction: vi.fn(async () => {
          events.push("store");
        }),
        refreshLeaderboardAfterPrediction
      })
    );

    expect(events).toEqual(["store", "reply", "refresh"]);
    expect(refreshLeaderboardAfterPrediction).toHaveBeenCalledOnce();
  });

  test("rejects invalid modal score input without storing", async () => {
    const upsertPrediction = vi.fn();
    const interaction = modalInteraction({
      customId: buildScoreModalCustomId("wc2026-001"),
      homeScoreText: "Mexico wins",
      awayScoreText: "1"
    });

    const result = await handlePredictionInteraction(
      interaction,
      options({
        upsertPrediction
      })
    );

    expect(result).toEqual({
      action: "rejected",
      reason: "invalid-score-format",
      matchId: "wc2026-001",
      userId: "user-1"
    });
    expect(upsertPrediction).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledWith({
      content: "Use apenas números nos dois campos do placar.",
      ephemeral: true
    });
  });

  test("rejects modal predictions until the match kickoff is verified", async () => {
    const upsertPrediction = vi.fn();
    const interaction = modalInteraction({
      customId: buildScoreModalCustomId("wc2026-001"),
      homeScoreText: "2",
      awayScoreText: "1"
    });

    const result = await handlePredictionInteraction(
      interaction,
      options({
        matches: [matchWithKickoff(null)],
        upsertPrediction
      })
    );

    expect(result).toEqual({
      action: "rejected",
      reason: "missing-kickoff",
      matchId: "wc2026-001",
      userId: "user-1"
    });
    expect(upsertPrediction).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledWith({
      content: "Predictions are not open yet because this match kickoff is not verified.",
      ephemeral: true
    });
  });

  test("rejects modal predictions at the exact cutoff", async () => {
    const upsertPrediction = vi.fn();
    const interaction = modalInteraction({
      customId: buildScoreModalCustomId("wc2026-001"),
      homeScoreText: "2",
      awayScoreText: "1",
      createdAt: new Date("2026-06-11T18:30:00.000Z")
    });

    const result = await handlePredictionInteraction(
      interaction,
      options({
        matches: [matchWithKickoff("2026-06-11T19:00:00.000Z")],
        upsertPrediction
      })
    );

    expect(result).toEqual({
      action: "rejected",
      reason: "closed",
      closesAtUtc: "2026-06-11T18:30:00.000Z",
      matchId: "wc2026-001",
      userId: "user-1"
    });
    expect(upsertPrediction).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledWith({
      content:
        "Predictions are closed for this match. Predictions close: <t:1781202600:F> (<t:1781202600:R>)",
      ephemeral: true
    });
  });
});

describe("handleDiscordPredictionInteraction", () => {
  test("maps Discord modal submits to prediction storage and ephemeral replies", async () => {
    const upsertPrediction = vi.fn();
    const interaction = discordModalInteraction();

    const result = await handleDiscordPredictionInteraction(
      interaction as unknown as Interaction,
      options({ upsertPrediction })
    );

    expect(result.action).toBe("accepted");
    expect(upsertPrediction).toHaveBeenCalledWith({
      userId: "user-1",
      matchId: "wc2026-001",
      messageId: "interaction-1",
      homeScore: 2,
      awayScore: 1,
      submittedAt: "2026-06-10T12:00:00.000Z",
      updatedAt: null,
      parserVersion: modalPredictionParserVersion
    });
    expect(interaction.reply).toHaveBeenCalledWith({
      content: [
        "Palpite salvo: México 2-1 África do Sul",
        "",
        "Meus palpites - 2026-06-11",
        "#1 México x África do Sul: 2x1"
      ].join("\n"),
      flags: MessageFlags.Ephemeral
    });
  });

  test("logs Discord prediction interaction outcomes", async () => {
    const logPredictionInteraction = vi.fn();
    const interaction = discordModalInteraction();

    const result = await handleDiscordPredictionInteraction(
      interaction as unknown as Interaction,
      options({ logPredictionInteraction })
    );

    expect(result.action).toBe("accepted");
    expect(logPredictionInteraction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "accepted",
        prediction: expect.objectContaining({
          userId: "user-1",
          matchId: "wc2026-001",
          homeScore: 2,
          awayScore: 1
        })
      })
    );
  });
});

function options(overrides: Partial<Parameters<typeof handlePredictionInteraction>[1]> = {}) {
  return {
    guildId: "guild-1",
    channelId: "channel-1",
    matches: [matchWithKickoff()],
    timeZone: "UTC",
    listPredictions: vi.fn(() => []),
    upsertPrediction: vi.fn(),
    ...overrides
  };
}

function buttonInteraction(
  overrides: Partial<Extract<PredictionInteraction, { kind: "button" }>> = {}
): Extract<PredictionInteraction, { kind: "button" }> {
  return {
    kind: "button",
    customId: "copanalhas:predict:wc2026-001",
    guildId: "guild-1",
    channelId: "channel-1",
    userId: "user-1",
    createdAt: new Date("2026-06-10T12:00:00.000Z"),
    showModal: vi.fn(async () => undefined),
    reply: vi.fn(async () => undefined),
    ...overrides
  };
}

function modalInteraction(
  overrides: Partial<Extract<PredictionInteraction, { kind: "modal-submit" }>> & {
    homeScoreText?: string;
    awayScoreText?: string;
  } = {}
): Extract<PredictionInteraction, { kind: "modal-submit" }> {
  const homeScoreText = overrides.homeScoreText ?? "2";
  const awayScoreText = overrides.awayScoreText ?? "1";
  const { homeScoreText: _homeScoreText, awayScoreText: _awayScoreText, ...rest } = overrides;

  return {
    kind: "modal-submit",
    customId: "copanalhas:score:wc2026-001",
    guildId: "guild-1",
    channelId: "channel-1",
    userId: "user-1",
    interactionId: "interaction-1",
    createdAt: new Date("2026-06-10T12:00:00.000Z"),
    getTextInputValue: vi.fn((customId: string) => {
      if (customId === homeScoreInputCustomId) {
        return homeScoreText;
      }

      if (customId === awayScoreInputCustomId) {
        return awayScoreText;
      }

      return "";
    }),
    reply: vi.fn(async () => undefined),
    ...rest
  };
}

function discordModalInteraction() {
  return {
    isButton: () => false,
    isModalSubmit: () => true,
    customId: buildScoreModalCustomId("wc2026-001"),
    guildId: "guild-1",
    channelId: "channel-1",
    user: {
      id: "user-1"
    },
    id: "interaction-1",
    createdAt: new Date("2026-06-10T12:00:00.000Z"),
    fields: {
      getTextInputValue: vi.fn((customId: string) => {
        if (customId === homeScoreInputCustomId) {
          return "2";
        }

        if (customId === awayScoreInputCustomId) {
          return "1";
        }

        return "";
      })
    },
    reply: vi.fn(async () => undefined)
  };
}

function storedPrediction(overrides: Partial<StoredPrediction> = {}): StoredPrediction {
  return {
    userId: "user-1",
    matchId: "wc2026-001",
    messageId: "interaction-1",
    homeScore: 2,
    awayScore: 1,
    submittedAt: "2026-06-10T12:00:00.000Z",
    updatedAt: null,
    parserVersion: "prediction-modal-v1",
    ...overrides
  };
}

function matchWithKickoff(kickoffAtUtc: string | null = "2026-06-11T19:00:00.000Z"): WorldCupMatch {
  return {
    ...firstSeedMatch(),
    kickoffAtUtc
  };
}

function firstSeedMatch(): WorldCupMatch {
  const match = WORLD_CUP_2026_SEED.matches[0];

  if (!match) {
    throw new Error("World Cup seed needs at least one match");
  }

  return match;
}
