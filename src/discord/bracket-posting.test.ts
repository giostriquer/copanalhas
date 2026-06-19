import { Buffer } from "node:buffer";

import { describe, expect, test, vi } from "vitest";

import {
  upsertDiscordBracketMessageWithClient,
  type DiscordBracketChannel,
  type DiscordBracketClient,
  type DiscordBracketMessagePayload,
  type DiscordBracketSentMessage,
  type DiscordEditableBracketMessage
} from "./bracket-posting.js";
import type { CopanalhasConfig } from "./config.js";
import type { BracketDashboardMessage } from "../bracket/format.js";

describe("upsertDiscordBracketMessageWithClient", () => {
  test("edits an existing bracket message in the configured channel", async () => {
    const edit = vi.fn(
      async (_payload: DiscordBracketMessagePayload): Promise<DiscordBracketSentMessage> => ({
        id: "bracket-message-1"
      })
    );
    const send = vi.fn(
      async (_payload: DiscordBracketMessagePayload): Promise<DiscordBracketSentMessage> => ({
        id: "replacement-message"
      })
    );
    const client = clientWithChannel({
      send,
      messages: {
        fetch: vi.fn(
          async (_messageId: string): Promise<DiscordEditableBracketMessage> => ({
            id: "bracket-message-1",
            edit
          })
        )
      }
    });

    await expect(
      upsertDiscordBracketMessageWithClient(config(), message(), "bracket-message-1", client)
    ).resolves.toBe("bracket-message-1");

    expect(client.login).toHaveBeenCalledWith("token-value");
    expect(client.channels.fetch).toHaveBeenCalledWith("channel-1");
    expect(edit).toHaveBeenCalledWith({
      content: message().content,
      embeds: message().embeds,
      files: message().files
    });
    expect(send).not.toHaveBeenCalled();
    expect(client.destroy).toHaveBeenCalledOnce();
  });

  test("sends a replacement when the existing bracket message cannot be fetched", async () => {
    const send = vi.fn(
      async (_payload: DiscordBracketMessagePayload): Promise<DiscordBracketSentMessage> => ({
        id: "replacement-message"
      })
    );
    const client = clientWithChannel({
      send,
      messages: {
        fetch: vi.fn(async (_messageId: string): Promise<DiscordEditableBracketMessage> => {
          throw new Error("missing message");
        })
      }
    });

    await expect(
      upsertDiscordBracketMessageWithClient(config(), message(), "bracket-message-1", client)
    ).resolves.toBe("replacement-message");

    expect(send).toHaveBeenCalledWith({
      content: message().content,
      embeds: message().embeds,
      files: message().files
    });
    expect(client.destroy).toHaveBeenCalledOnce();
  });

  test("sends a new bracket message when no existing id is stored", async () => {
    const send = vi.fn(
      async (_payload: DiscordBracketMessagePayload): Promise<DiscordBracketSentMessage> => ({
        id: "new-message"
      })
    );
    const fetch = vi.fn(
      async (_messageId: string): Promise<DiscordEditableBracketMessage> => ({
        id: "unused",
        edit: vi.fn()
      })
    );
    const client = clientWithChannel({
      send,
      messages: { fetch }
    });

    await expect(upsertDiscordBracketMessageWithClient(config(), message(), null, client)).resolves.toBe(
      "new-message"
    );

    expect(fetch).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledWith({
      content: message().content,
      embeds: message().embeds,
      files: message().files
    });
  });
});

function clientWithChannel(channel: {
  send: NonNullable<DiscordBracketChannel["send"]>;
  messages?: NonNullable<DiscordBracketChannel["messages"]>;
}): DiscordBracketClient {
  const discordChannel: DiscordBracketChannel = {
    isTextBased: () => true,
    send: channel.send,
    ...(channel.messages ? { messages: channel.messages } : {})
  };

  return {
    login: vi.fn(async () => undefined),
    channels: {
      fetch: vi.fn(async () => discordChannel)
    },
    destroy: vi.fn(async () => undefined)
  };
}

function message(): BracketDashboardMessage {
  return {
    content: "World Cup 2026 Bracket",
    embeds: [],
    files: [{ attachment: Buffer.from("png"), name: "copanalhas-bracket.png" }]
  };
}

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
