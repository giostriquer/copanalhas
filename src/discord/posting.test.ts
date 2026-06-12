import { describe, expect, test, vi } from "vitest";

import { createMatchCardMessage } from "./components.js";
import {
  deleteMatchStartAlertWithClient,
  postMatchCardsWithClient,
  postMatchStartAlertWithClient,
  type DiscordMatchStartAlertClient,
  type DiscordPosterClient
} from "./posting.js";
import type { CopanalhasConfig } from "./config.js";
import { WORLD_CUP_2026_SEED } from "../worldcup/seed.js";

describe("postMatchCardsWithClient", () => {
  test("logs in, sends each match card to the configured channel, and destroys the client", async () => {
    const channel = {
      isTextBased: vi.fn(() => true),
      send: vi
        .fn()
        .mockResolvedValueOnce({ id: "discord-message-1" })
        .mockResolvedValueOnce({ id: "discord-message-2" })
    };
    const client: DiscordPosterClient = {
      login: vi.fn(async () => undefined),
      channels: {
        fetch: vi.fn(async () => channel)
      },
      destroy: vi.fn(async () => undefined)
    };
    const [firstMatch, secondMatch] = WORLD_CUP_2026_SEED.matches;

    if (!firstMatch || !secondMatch) {
      throw new Error("World Cup seed needs at least two matches for posting tests");
    }

    const messages = [createMatchCardMessage(firstMatch), createMatchCardMessage(secondMatch)];

    const result = await postMatchCardsWithClient(config(), messages, client);

    expect(client.login).toHaveBeenCalledWith("token-value");
    expect(client.channels.fetch).toHaveBeenCalledWith("channel-1");
    expect(channel.send).toHaveBeenCalledTimes(2);
    expect(channel.send).toHaveBeenNthCalledWith(1, messages[0]);
    expect(channel.send).toHaveBeenNthCalledWith(2, messages[1]);
    expect(result).toEqual(["discord-message-1", "discord-message-2"]);
    expect(client.destroy).toHaveBeenCalledOnce();
  });
});

describe("postMatchStartAlertWithClient", () => {
  test("sends a match start alert with only the configured role mention allowed", async () => {
    const channel = {
      isTextBased: vi.fn(() => true),
      send: vi.fn(async () => ({ id: "match-start-message-1" }))
    };
    const client: DiscordMatchStartAlertClient = {
      login: vi.fn(async () => undefined),
      channels: {
        fetch: vi.fn(async () => channel)
      },
      destroy: vi.fn(async () => undefined)
    };
    const message = {
      content: "<@&role-canalhas>\nPARTIDA COMEÇOU\nMéxico x África do Sul",
      allowedMentions: { parse: [] as [], roles: ["role-canalhas"] }
    };

    const result = await postMatchStartAlertWithClient(config(), message, client);

    expect(client.login).toHaveBeenCalledWith("token-value");
    expect(client.channels.fetch).toHaveBeenCalledWith("channel-1");
    expect(channel.send).toHaveBeenCalledWith(message);
    expect(result).toBe("match-start-message-1");
    expect(client.destroy).toHaveBeenCalledOnce();
  });
});

describe("deleteMatchStartAlertWithClient", () => {
  test("fetches and deletes a previously posted match start alert", async () => {
    const message = {
      delete: vi.fn(async () => undefined)
    };
    const channel = {
      isTextBased: vi.fn(() => true),
      send: vi.fn(),
      messages: {
        fetch: vi.fn(async () => message)
      }
    };
    const client: DiscordMatchStartAlertClient = {
      login: vi.fn(async () => undefined),
      channels: {
        fetch: vi.fn(async () => channel)
      },
      destroy: vi.fn(async () => undefined)
    };

    await deleteMatchStartAlertWithClient(config(), "match-start-message-1", client);

    expect(client.login).toHaveBeenCalledWith("token-value");
    expect(client.channels.fetch).toHaveBeenCalledWith("channel-1");
    expect(channel.messages.fetch).toHaveBeenCalledWith("match-start-message-1");
    expect(message.delete).toHaveBeenCalledOnce();
    expect(client.destroy).toHaveBeenCalledOnce();
  });
});

function config(): CopanalhasConfig {
  return {
    discordToken: "token-value",
    guildId: "guild-1",
    channelId: "channel-1",
    databasePath: "./data/copanalhas.sqlite",
    autoPostEnabled: true,
    autoPostTime: "09:00",
    autoPostWindowDays: 3,
    timezone: "America/Sao_Paulo",
    matchdayRolloverTime: "06:00",
    footballDataToken: null,
    resultSyncEnabled: false,
    resultSyncFirstCheckMinutes: 110,
    resultSyncRetryMinutes: 1
  };
}
