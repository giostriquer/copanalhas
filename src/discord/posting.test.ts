import { describe, expect, test, vi } from "vitest";

import { createMatchCardMessage } from "./components.js";
import { postMatchCardsWithClient, type DiscordPosterClient } from "./posting.js";
import type { CopanalhasConfig } from "./config.js";
import { WORLD_CUP_2026_SEED } from "../worldcup/seed.js";

describe("postMatchCardsWithClient", () => {
  test("logs in, sends each match card to the configured channel, and destroys the client", async () => {
    const channel = {
      isTextBased: vi.fn(() => true),
      send: vi.fn(async () => undefined)
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

    await postMatchCardsWithClient(config(), messages, client);

    expect(client.login).toHaveBeenCalledWith("token-value");
    expect(client.channels.fetch).toHaveBeenCalledWith("channel-1");
    expect(channel.send).toHaveBeenCalledTimes(2);
    expect(channel.send).toHaveBeenNthCalledWith(1, messages[0]);
    expect(channel.send).toHaveBeenNthCalledWith(2, messages[1]);
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
    timezone: "America/Sao_Paulo",
    footballDataToken: null,
    resultSyncEnabled: false
  };
}
