import { Buffer } from "node:buffer";

import { describe, expect, test, vi } from "vitest";

import {
  upsertDiscordLeaderboardMessageWithClient,
  type DiscordEditableLeaderboardMessage,
  type DiscordLeaderboardChannel,
  type DiscordLeaderboardClient,
  type DiscordLeaderboardMessagePayload,
  type DiscordLeaderboardSentMessage
} from "./leaderboard-posting.js";
import type { CopanalhasConfig } from "./config.js";
import type { LeaderboardDashboardMessage } from "../leaderboard/format.js";

describe("upsertDiscordLeaderboardMessageWithClient", () => {
  test("edits an existing leaderboard message in the configured channel", async () => {
    const edit = vi.fn(
      async (_payload: DiscordLeaderboardMessagePayload): Promise<DiscordLeaderboardSentMessage> => ({
        id: "leaderboard-message-1"
      })
    );
    const send = vi.fn(
      async (_payload: DiscordLeaderboardMessagePayload): Promise<DiscordLeaderboardSentMessage> => ({
        id: "replacement-message"
      })
    );
    const client = clientWithChannel({
      send,
      messages: {
        fetch: vi.fn(
          async (_messageId: string): Promise<DiscordEditableLeaderboardMessage> => ({
            id: "leaderboard-message-1",
            edit
          })
        )
      }
    });

    await expect(
      upsertDiscordLeaderboardMessageWithClient(
        config(),
        message(),
        "leaderboard-message-1",
        client
      )
    ).resolves.toBe("leaderboard-message-1");

    expect(client.login).toHaveBeenCalledWith("token-value");
    expect(client.channels.fetch).toHaveBeenCalledWith("channel-1");
    expect(edit).toHaveBeenCalledWith({
      content: message().content,
      embeds: message().embeds,
      files: message().files,
      attachments: []
    });
    expect(send).not.toHaveBeenCalled();
    expect(client.destroy).toHaveBeenCalledOnce();
  });

  test("sends a replacement when the existing leaderboard message cannot be fetched", async () => {
    const send = vi.fn(
      async (_payload: DiscordLeaderboardMessagePayload): Promise<DiscordLeaderboardSentMessage> => ({
        id: "replacement-message"
      })
    );
    const client = clientWithChannel({
      send,
      messages: {
        fetch: vi.fn(async (_messageId: string): Promise<DiscordEditableLeaderboardMessage> => {
          throw new Error("missing message");
        })
      }
    });

    await expect(
      upsertDiscordLeaderboardMessageWithClient(
        config(),
        message(),
        "leaderboard-message-1",
        client
      )
    ).resolves.toBe("replacement-message");

    expect(send).toHaveBeenCalledWith({
      content: message().content,
      embeds: message().embeds,
      files: message().files
    });
    expect(client.destroy).toHaveBeenCalledOnce();
  });

  test("sends a new leaderboard message when no existing id is stored", async () => {
    const send = vi.fn(
      async (_payload: DiscordLeaderboardMessagePayload): Promise<DiscordLeaderboardSentMessage> => ({
        id: "new-message"
      })
    );
    const fetch = vi.fn(
      async (_messageId: string): Promise<DiscordEditableLeaderboardMessage> => ({
        id: "unused",
        edit: vi.fn()
      })
    );
    const client = clientWithChannel({
      send,
      messages: { fetch }
    });

    await expect(
      upsertDiscordLeaderboardMessageWithClient(config(), message(), null, client)
    ).resolves.toBe("new-message");

    expect(fetch).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledWith({
      content: message().content,
      embeds: message().embeds,
      files: message().files
    });
  });
});

function clientWithChannel(channel: {
  send: NonNullable<DiscordLeaderboardChannel["send"]>;
  messages?: NonNullable<DiscordLeaderboardChannel["messages"]>;
}): DiscordLeaderboardClient {
  const discordChannel: DiscordLeaderboardChannel = {
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

function message(): LeaderboardDashboardMessage {
  return {
    content: "Copanalhas Leaderboard\n```text\nNo scored matches yet.\n```",
    embeds: [],
    files: [{ attachment: Buffer.from("png"), name: "copanalhas-leaderboard.png" }]
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
