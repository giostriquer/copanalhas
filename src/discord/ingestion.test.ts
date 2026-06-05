import { describe, expect, test, vi } from "vitest";

import { handleDiscordMessage } from "./ingestion.js";
import type { PredictionParseResult } from "../predictions/parser.js";

describe("handleDiscordMessage", () => {
  test("ignores messages outside the configured guild before parsing", () => {
    const parse = vi.fn();

    const result = handleDiscordMessage(message({ guildId: "other-guild" }), {
      guildId: "guild-1",
      channelId: "channel-1",
      parsePrediction: parse
    });

    expect(result).toEqual({ action: "ignored", reason: "wrong-guild" });
    expect(parse).not.toHaveBeenCalled();
  });

  test("ignores messages outside the configured channel before parsing", () => {
    const parse = vi.fn();

    const result = handleDiscordMessage(message({ channelId: "other-channel" }), {
      guildId: "guild-1",
      channelId: "channel-1",
      parsePrediction: parse
    });

    expect(result).toEqual({ action: "ignored", reason: "wrong-channel" });
    expect(parse).not.toHaveBeenCalled();
  });

  test("ignores bot-authored messages before parsing", () => {
    const parse = vi.fn();

    const result = handleDiscordMessage(message({ authorIsBot: true }), {
      guildId: "guild-1",
      channelId: "channel-1",
      parsePrediction: parse
    });

    expect(result).toEqual({ action: "ignored", reason: "bot-author" });
    expect(parse).not.toHaveBeenCalled();
  });

  test("ignores empty content before parsing", () => {
    const parse = vi.fn();

    const result = handleDiscordMessage(message({ content: "" }), {
      guildId: "guild-1",
      channelId: "channel-1",
      parsePrediction: parse
    });

    expect(result).toEqual({ action: "ignored", reason: "empty-content" });
    expect(parse).not.toHaveBeenCalled();
  });

  test("accepts parsed predictions from the configured channel", () => {
    const parse = vi.fn(
      (): PredictionParseResult => ({
      ok: true,
      prediction: {
        matchNumber: 1,
        homeTeamCode: "MEX",
        awayTeamCode: "RSA",
        homeScore: 2,
        awayScore: 1,
        normalizedText: "#1 MEX 2-1 RSA"
      }
    }));

    const result = handleDiscordMessage(message({ content: "#1 MEX 2-1 RSA" }), {
      guildId: "guild-1",
      channelId: "channel-1",
      parsePrediction: parse
    });

    expect(result).toEqual({
      action: "accepted",
      prediction: {
        userId: "user-1",
        messageId: "message-1",
        matchNumber: 1,
        homeTeamCode: "MEX",
        awayTeamCode: "RSA",
        homeScore: 2,
        awayScore: 1,
        submittedAt: "2026-06-10T12:00:00.000Z",
        updatedAt: null,
        parserVersion: "prediction-parser-v1"
      }
    });
    expect(parse).toHaveBeenCalledWith("#1 MEX 2-1 RSA");
  });

  test("returns parser rejections without storing raw content", () => {
    const parse = vi.fn(
      (): PredictionParseResult => ({ ok: false, reason: "unsupported-format" })
    );

    const result = handleDiscordMessage(message({ content: "hello" }), {
      guildId: "guild-1",
      channelId: "channel-1",
      parsePrediction: parse
    });

    expect(result).toEqual({
      action: "rejected",
      reason: "unsupported-format",
      messageId: "message-1",
      userId: "user-1"
    });
  });
});

function message(overrides: Partial<Parameters<typeof handleDiscordMessage>[0]> = {}) {
  return {
    id: "message-1",
    guildId: "guild-1",
    channelId: "channel-1",
    authorId: "user-1",
    authorIsBot: false,
    content: "MEX 2-1 RSA",
    createdAt: new Date("2026-06-10T12:00:00.000Z"),
    editedAt: null,
    ...overrides
  };
}
