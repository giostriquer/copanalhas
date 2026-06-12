import { describe, expect, test, vi } from "vitest";

import {
  upsertDiscordStandingsMessageWithClient,
  type DiscordEditableStandingsMessage,
  type DiscordStandingsChannel,
  type DiscordStandingsClient,
  type DiscordStandingsMessagePayload,
  type DiscordStandingsSentMessage
} from "./standings-posting.js";
import type { CopanalhasConfig } from "./config.js";
import type { StandingsDashboardMessage } from "../standings/format.js";

describe("upsertDiscordStandingsMessageWithClient", () => {
  test("edits an existing standings message in the configured channel", async () => {
    const edit = vi.fn(
      async (_payload: DiscordStandingsMessagePayload): Promise<DiscordStandingsSentMessage> => ({
        id: "message-1"
      })
    );
    const send = vi.fn(
      async (_payload: DiscordStandingsMessagePayload): Promise<DiscordStandingsSentMessage> => ({
        id: "replacement-message"
      })
    );
    const client = clientWithChannel({
      send,
      messages: {
        fetch: vi.fn(
          async (_messageId: string): Promise<DiscordEditableStandingsMessage> => ({
            id: "message-1",
            edit
          })
        )
      }
    });

    await expect(
      upsertDiscordStandingsMessageWithClient(config(), message(), "message-1", client)
    ).resolves.toBe("message-1");

    expect(client.login).toHaveBeenCalledWith("token-value");
    expect(client.channels.fetch).toHaveBeenCalledWith("channel-1");
    expect(edit).toHaveBeenCalledWith({
      content: message().content,
      embeds: message().embeds
    });
    expect(send).not.toHaveBeenCalled();
    expect(client.destroy).toHaveBeenCalledOnce();
  });

  test("sends a replacement when the existing standings message cannot be fetched", async () => {
    const send = vi.fn(
      async (_payload: DiscordStandingsMessagePayload): Promise<DiscordStandingsSentMessage> => ({
        id: "replacement-message"
      })
    );
    const client = clientWithChannel({
      send,
      messages: {
        fetch: vi.fn(async (_messageId: string): Promise<DiscordEditableStandingsMessage> => {
          throw new Error("missing message");
        })
      }
    });

    await expect(
      upsertDiscordStandingsMessageWithClient(config(), message(), "message-1", client)
    ).resolves.toBe("replacement-message");

    expect(send).toHaveBeenCalledWith({
      content: message().content,
      embeds: message().embeds
    });
    expect(client.destroy).toHaveBeenCalledOnce();
  });

  test("sends a new standings message when no existing id is stored", async () => {
    const send = vi.fn(
      async (_payload: DiscordStandingsMessagePayload): Promise<DiscordStandingsSentMessage> => ({
        id: "new-message"
      })
    );
    const fetch = vi.fn(
      async (_messageId: string): Promise<DiscordEditableStandingsMessage> => ({
        id: "unused",
        edit: vi.fn()
      })
    );
    const client = clientWithChannel({
      send,
      messages: { fetch }
    });

    await expect(
      upsertDiscordStandingsMessageWithClient(config(), message(), null, client)
    ).resolves.toBe("new-message");

    expect(fetch).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledWith({
      content: message().content,
      embeds: message().embeds
    });
  });
});

function clientWithChannel(channel: {
  send: NonNullable<DiscordStandingsChannel["send"]>;
  messages?: NonNullable<DiscordStandingsChannel["messages"]>;
}): DiscordStandingsClient {
  const discordChannel: DiscordStandingsChannel = {
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

function message(): StandingsDashboardMessage {
  return {
    key: "groups_a_f",
    content: "World Cup 2026 Group Standings\nGroups A-F\n```text\n# Team Pts\n```",
    embeds: []
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
