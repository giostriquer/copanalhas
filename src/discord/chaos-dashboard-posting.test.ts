import { Buffer } from "node:buffer";

import { describe, expect, test, vi } from "vitest";

import {
  upsertDiscordChaosDashboardMessageWithClient,
  type DiscordChaosDashboardChannel,
  type DiscordChaosDashboardClient,
  type DiscordChaosDashboardMessagePayload,
  type DiscordChaosDashboardSentMessage,
  type DiscordEditableChaosDashboardMessage
} from "./chaos-dashboard-posting.js";
import type { CopanalhasConfig } from "./config.js";
import type { ChaosDashboardMessage } from "../chaos-dashboard/format.js";

describe("upsertDiscordChaosDashboardMessageWithClient", () => {
  test("edits an existing chaos dashboard message in the configured channel", async () => {
    const edit = vi.fn(
      async (
        _payload: DiscordChaosDashboardMessagePayload
      ): Promise<DiscordChaosDashboardSentMessage> => ({
        id: "chaos-message-1"
      })
    );
    const send = vi.fn(
      async (
        _payload: DiscordChaosDashboardMessagePayload
      ): Promise<DiscordChaosDashboardSentMessage> => ({
        id: "replacement-message"
      })
    );
    const client = clientWithChannel({
      send,
      messages: {
        fetch: vi.fn(
          async (_messageId: string): Promise<DiscordEditableChaosDashboardMessage> => ({
            id: "chaos-message-1",
            edit
          })
        )
      }
    });

    await expect(
      upsertDiscordChaosDashboardMessageWithClient(config(), message(), "chaos-message-1", client)
    ).resolves.toBe("chaos-message-1");

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

  test("sends a replacement when the existing chaos dashboard message cannot be fetched", async () => {
    const send = vi.fn(
      async (
        _payload: DiscordChaosDashboardMessagePayload
      ): Promise<DiscordChaosDashboardSentMessage> => ({
        id: "replacement-message"
      })
    );
    const client = clientWithChannel({
      send,
      messages: {
        fetch: vi.fn(async (_messageId: string): Promise<DiscordEditableChaosDashboardMessage> => {
          throw new Error("missing message");
        })
      }
    });

    await expect(
      upsertDiscordChaosDashboardMessageWithClient(config(), message(), "chaos-message-1", client)
    ).resolves.toBe("replacement-message");

    expect(send).toHaveBeenCalledWith({
      content: message().content,
      embeds: message().embeds,
      files: message().files
    });
    expect(client.destroy).toHaveBeenCalledOnce();
  });

  test("sends a new chaos dashboard message when no existing id is stored", async () => {
    const send = vi.fn(
      async (
        _payload: DiscordChaosDashboardMessagePayload
      ): Promise<DiscordChaosDashboardSentMessage> => ({
        id: "new-message"
      })
    );
    const fetch = vi.fn(
      async (_messageId: string): Promise<DiscordEditableChaosDashboardMessage> => ({
        id: "unused",
        edit: vi.fn()
      })
    );
    const client = clientWithChannel({
      send,
      messages: { fetch }
    });

    await expect(
      upsertDiscordChaosDashboardMessageWithClient(config(), message(), null, client)
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
  send: NonNullable<DiscordChaosDashboardChannel["send"]>;
  messages?: NonNullable<DiscordChaosDashboardChannel["messages"]>;
}): DiscordChaosDashboardClient {
  const discordChannel: DiscordChaosDashboardChannel = {
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

function message(): ChaosDashboardMessage {
  return {
    content: "Copanalhas Recap",
    embeds: [],
    files: [{ attachment: Buffer.from("png"), name: "copanalhas-recap.png" }]
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
    resultSyncRetryMinutes: 1,
    recapCodexEnabled: false,
    recapCodexCommand: "codex",
    recapCodexOutputDir: "./data/recap-copy",
    recapCodexTimeoutMs: 120000
  };
}
