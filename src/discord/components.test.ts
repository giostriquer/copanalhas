import { describe, expect, test } from "vitest";

import {
  buildPredictButtonCustomId,
  buildScoreModalCustomId,
  buildMatchCardView,
  createMatchCardMessage,
  createPredictionModal,
  parsePredictButtonCustomId,
  parseScoreModalCustomId,
  scoreInputCustomId
} from "./components.js";
import { WORLD_CUP_2026_SEED } from "../worldcup/seed.js";

describe("prediction component ids", () => {
  test("builds and parses predict button ids", () => {
    const customId = buildPredictButtonCustomId("wc2026-001");

    expect(customId).toBe("copanalhas:predict:wc2026-001");
    expect(parsePredictButtonCustomId(customId)).toEqual({ matchId: "wc2026-001" });
    expect(parsePredictButtonCustomId("copanalhas:score:wc2026-001")).toBeUndefined();
  });

  test("builds and parses score modal ids", () => {
    const customId = buildScoreModalCustomId("wc2026-001");

    expect(customId).toBe("copanalhas:score:wc2026-001");
    expect(parseScoreModalCustomId(customId)).toEqual({ matchId: "wc2026-001" });
    expect(parseScoreModalCustomId("copanalhas:predict:wc2026-001")).toBeUndefined();
  });
});

describe("match cards", () => {
  test("builds a member-friendly match card view", () => {
    expect(buildMatchCardView(firstSeedMatch())).toEqual({
      matchId: "wc2026-001",
      predictButtonCustomId: "copanalhas:predict:wc2026-001",
      content: [
        "MATCH OF THE DAY",
        "Match #1 - Group A",
        "Mexico vs South Africa",
        "Kickoff: 2026-06-11",
        "Click Predict and enter a score like 2x1."
      ].join("\n")
    });
  });

  test("creates a Discord message payload with a Predict button", () => {
    const payload = createMatchCardMessage(firstSeedMatch());
    const json = payload.components[0]?.toJSON();

    expect(payload.content).toContain("Mexico vs South Africa");
    expect(json).toEqual({
      type: 1,
      components: [
        {
          type: 2,
          custom_id: "copanalhas:predict:wc2026-001",
          label: "Predict",
          style: 1
        }
      ]
    });
  });

  test("creates a score modal payload for one match", () => {
    const modal = createPredictionModal(firstSeedMatch()).toJSON();
    const row = modal.components[0] as { components: Array<{ custom_id?: string }> } | undefined;

    expect(modal.custom_id).toBe("copanalhas:score:wc2026-001");
    expect(modal.title).toBe("Mexico vs South Africa");
    expect(row?.components[0]?.custom_id).toBe(scoreInputCustomId);
  });
});

function firstSeedMatch() {
  const match = WORLD_CUP_2026_SEED.matches[0];

  if (!match) {
    throw new Error("World Cup seed needs at least one match");
  }

  return match;
}
