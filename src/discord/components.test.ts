import { describe, expect, test } from "vitest";

import {
  awayScoreInputCustomId,
  buildPredictButtonCustomId,
  buildScoreModalCustomId,
  createMatchDayMessage,
  buildMatchCardView,
  createMatchCardMessage,
  createPredictionModal,
  homeScoreInputCustomId,
  parsePredictButtonCustomId,
  parseScoreModalCustomId,
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
    expect(buildMatchCardView(firstSeedMatch(), { timeZone: "UTC" })).toEqual({
      matchId: "wc2026-001",
      predictButtonCustomId: "copanalhas:predict:wc2026-001",
      content: [
        "MATCH OF THE DAY",
        "Match #1 - Group A",
        "México vs África do Sul",
        "Kickoff: <t:1781204400:F> (<t:1781204400:R>)",
        "Predictions close: <t:1781202600:F> (<t:1781202600:R>)",
        "Click Predict and enter a score like 2x1."
      ].join("\n")
    });
  });

  test("creates a Discord message payload with a Predict button", () => {
    const payload = createMatchCardMessage(firstSeedMatch());
    const json = payload.components[0]?.toJSON();

    expect(payload.content).toContain("México vs África do Sul");
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

  test("creates one matchday payload with multiple match-specific buttons", () => {
    const payload = createMatchDayMessage([firstSeedMatch(), secondSeedMatch()], {
      date: "2026-06-11",
      timeZone: "UTC"
    });

    expect(payload.content).toBe("JOGOS DO DIA");
    expect(payload.embeds?.map((embed) => embed.toJSON())).toEqual([
      expect.objectContaining({
        title: "quinta-feira, 11 de junho de 2026",
        description: "Use os botões abaixo para enviar seu palpite.",
        fields: [
          {
            name: "#1 · Grupo A",
            value: [
              "México x África do Sul",
              "Partida: <t:1781204400:t> (<t:1781204400:R>)",
              "Apostas encerram: <t:1781202600:t>"
            ].join("\n"),
            inline: true
          },
          {
            name: "#2 · Grupo A",
            value: [
              "Coreia do Sul x Tchéquia",
              "Partida: <t:1781229600:t> (<t:1781229600:R>)",
              "Apostas encerram: <t:1781227800:t>"
            ].join("\n"),
            inline: true
          }
        ]
      })
    ]);
    expect(payload.components.map((row) => row.toJSON())).toEqual([
      {
        type: 1,
        components: [
          {
            type: 2,
            custom_id: "copanalhas:predict:wc2026-001",
            label: "Palpite #1",
            style: 1
          },
          {
            type: 2,
            custom_id: "copanalhas:predict:wc2026-002",
            label: "Palpite #2",
            style: 1
          }
        ]
      }
    ]);
  });

  test("formats knockout placeholder matches without group-stage labels", () => {
    const match = seedMatchByNumber(73);

    expect(buildMatchCardView(match, { timeZone: "America/Sao_Paulo" })).toMatchObject({
      matchId: "wc2026-073",
      predictButtonCustomId: "copanalhas:predict:wc2026-073",
      content: expect.stringContaining("Match #73 - Rodada de 32")
    });

    const payload = createMatchDayMessage([match], {
      date: "2026-06-28",
      timeZone: "America/Sao_Paulo"
    });

    expect(payload.embeds?.[0]?.toJSON().fields?.[0]).toMatchObject({
      name: "#73 · Rodada de 32",
      value: expect.stringContaining("2º Grupo A x 2º Grupo B")
    });
  });

  test("creates a score modal payload for one match", () => {
    const modal = createPredictionModal(firstSeedMatch()).toJSON();
    const firstRow = modal.components[0] as { components: Array<{ custom_id?: string }> } | undefined;
    const secondRow = modal.components[1] as { components: Array<{ custom_id?: string }> } | undefined;

    expect(modal.custom_id).toBe("copanalhas:score:wc2026-001");
    expect(modal.title).toBe("México x África do Sul");
    expect(firstRow?.components[0]).toMatchObject({
      custom_id: homeScoreInputCustomId,
      label: "México",
      placeholder: "0",
      required: true,
      min_length: 1,
      max_length: 2
    });
    expect(secondRow?.components[0]).toMatchObject({
      custom_id: awayScoreInputCustomId,
      label: "África do Sul",
      placeholder: "0",
      required: true,
      min_length: 1,
      max_length: 2
    });
  });

  test("keeps group-stage score modals free of knockout decision options", () => {
    const modal = createPredictionModal(firstSeedMatch()).toJSON();

    expect(JSON.stringify(modal)).not.toContain("Tempo regulamentar");
    expect(JSON.stringify(modal)).not.toContain("Prorrogação");
    expect(JSON.stringify(modal)).not.toContain("Cobrança de pênaltis");
  });

  test("adds decision method options to knockout score modals", () => {
    const modal = createPredictionModal(seedMatchByNumber(73)).toJSON();
    const serialized = JSON.stringify(modal);

    expect(serialized).toContain("Tempo regulamentar");
    expect(serialized).toContain("Prorrogação");
    expect(serialized).toContain("Cobrança de pênaltis");
  });

  test("pre-fills the score modal with an existing prediction", () => {
    const modal = createPredictionModal(firstSeedMatch(), {
      userId: "user-1",
      matchId: "wc2026-001",
      messageId: "interaction-1",
      homeScore: 2,
      awayScore: 1,
      submittedAt: "2026-06-10T12:00:00.000Z",
      updatedAt: null,
      parserVersion: "prediction-modal-v1"
    }).toJSON();
    const firstRow = modal.components[0] as { components: Array<{ value?: string }> } | undefined;
    const secondRow = modal.components[1] as { components: Array<{ value?: string }> } | undefined;

    expect(firstRow?.components[0]?.value).toBe("2");
    expect(secondRow?.components[0]?.value).toBe("1");
  });

  test("pre-fills the knockout decision method", () => {
    const modal = createPredictionModal(seedMatchByNumber(73), {
      userId: "user-1",
      matchId: "wc2026-073",
      messageId: "interaction-1",
      homeScore: 1,
      awayScore: 1,
      decisionMethod: "penalties",
      submittedAt: "2026-06-29T12:00:00.000Z",
      updatedAt: null,
      parserVersion: "prediction-modal-v2"
    }).toJSON();

    expect(JSON.stringify(modal)).toContain("\"default\":true");
    expect(JSON.stringify(modal)).toContain("\"value\":\"penalties\"");
  });
});

function firstSeedMatch() {
  const match = WORLD_CUP_2026_SEED.matches[0];

  if (!match) {
    throw new Error("World Cup seed needs at least one match");
  }

  return match;
}

function secondSeedMatch() {
  const match = WORLD_CUP_2026_SEED.matches[1];

  if (!match) {
    throw new Error("World Cup seed needs at least two matches");
  }

  return match;
}

function seedMatchByNumber(matchNumber: number) {
  const match = WORLD_CUP_2026_SEED.matches.find(
    (candidate) => candidate.matchNumber === matchNumber
  );

  if (!match) {
    throw new Error(`Missing World Cup seed match #${matchNumber}`);
  }

  return match;
}
