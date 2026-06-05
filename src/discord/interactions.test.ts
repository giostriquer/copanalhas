import { describe, expect, test, vi } from "vitest";
import { MessageFlags, type Interaction } from "discord.js";

import {
  handleDiscordPredictionInteraction,
  handlePredictionInteraction,
  modalPredictionParserVersion,
  type PredictionInteraction
} from "./interactions.js";
import { buildPredictButtonCustomId, buildScoreModalCustomId } from "./components.js";
import type { StoredPrediction } from "../storage/database.js";
import { WORLD_CUP_2026_SEED } from "../worldcup/seed.js";

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
      title: "Mexico vs South Africa"
    });
    expect(interaction.reply).not.toHaveBeenCalled();
  });

  test("stores a modal score prediction and replies privately", async () => {
    const storedPredictions: StoredPrediction[] = [];
    const interaction = modalInteraction({
      customId: buildScoreModalCustomId("wc2026-001"),
      scoreText: "2x1"
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
      content: "Saved: Mexico 2-1 South Africa",
      ephemeral: true
    });
  });

  test("rejects invalid modal score input without storing", async () => {
    const upsertPrediction = vi.fn();
    const interaction = modalInteraction({
      customId: buildScoreModalCustomId("wc2026-001"),
      scoreText: "Mexico wins"
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
      content: "Use a score like 2x1 or 2-1.",
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
      content: "Saved: Mexico 2-1 South Africa",
      flags: MessageFlags.Ephemeral
    });
  });
});

function options(overrides: Partial<Parameters<typeof handlePredictionInteraction>[1]> = {}) {
  return {
    guildId: "guild-1",
    channelId: "channel-1",
    matches: WORLD_CUP_2026_SEED.matches,
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
    showModal: vi.fn(async () => undefined),
    reply: vi.fn(async () => undefined),
    ...overrides
  };
}

function modalInteraction(
  overrides: Partial<Extract<PredictionInteraction, { kind: "modal-submit" }>> & {
    scoreText?: string;
  } = {}
): Extract<PredictionInteraction, { kind: "modal-submit" }> {
  const scoreText = overrides.scoreText ?? "2x1";
  const { scoreText: _scoreText, ...rest } = overrides;

  return {
    kind: "modal-submit",
    customId: "copanalhas:score:wc2026-001",
    guildId: "guild-1",
    channelId: "channel-1",
    userId: "user-1",
    interactionId: "interaction-1",
    createdAt: new Date("2026-06-10T12:00:00.000Z"),
    getTextInputValue: vi.fn(() => scoreText),
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
      getTextInputValue: vi.fn(() => "2x1")
    },
    reply: vi.fn(async () => undefined)
  };
}
