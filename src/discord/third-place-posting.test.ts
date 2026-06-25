import { describe, expect, test, vi } from "vitest";

import {
  upsertDiscordThirdPlaceMessageWithClient,
  type DiscordEditableThirdPlaceMessage,
  type DiscordThirdPlaceChannel,
  type DiscordThirdPlaceClient,
  type DiscordThirdPlaceMessagePayload,
  type DiscordThirdPlaceSentMessage
} from "./third-place-posting.js";
import type { ThirdPlaceDashboardMessage } from "../third-place/format.js";

describe("upsertDiscordThirdPlaceMessageWithClient", () => {
  test("edits an existing third-place message in the configured channel", async () => {
    const edit = vi.fn(
      async (_payload: DiscordThirdPlaceMessagePayload): Promise<DiscordThirdPlaceSentMessage> => ({
        id: "third-place-message-1"
      })
    );
    const client = clientWithChannel({
      send: vi.fn(
        async (_payload: DiscordThirdPlaceMessagePayload): Promise<DiscordThirdPlaceSentMessage> => ({
          id: "new-message"
        })
      ),
      messages: {
        fetch: vi.fn(
          async (_messageId: string): Promise<DiscordEditableThirdPlaceMessage> => ({
            id: "third-place-message-1",
            edit
          })
        )
      }
    });

    await expect(
      upsertDiscordThirdPlaceMessageWithClient(
        config(),
        message(),
        "third-place-message-1",
        client
      )
    ).resolves.toBe("third-place-message-1");
    expect(edit).toHaveBeenCalledWith(
      expect.objectContaining({
        content: "third places",
        attachments: []
      })
    );
  });

  test("sends a replacement when the stored message cannot be fetched", async () => {
    const send = vi.fn(
      async (_payload: DiscordThirdPlaceMessagePayload): Promise<DiscordThirdPlaceSentMessage> => ({
        id: "replacement-message"
      })
    );
    const client = clientWithChannel({
      send,
      messages: {
        fetch: vi.fn(async (_messageId: string): Promise<DiscordEditableThirdPlaceMessage> => {
          throw new Error("missing");
        })
      }
    });

    await expect(
      upsertDiscordThirdPlaceMessageWithClient(
        config(),
        message(),
        "third-place-message-1",
        client
      )
    ).resolves.toBe("replacement-message");
    expect(send).toHaveBeenCalledOnce();
  });

  test("sends a new third-place message when no existing id is stored", async () => {
    const send = vi.fn(
      async (_payload: DiscordThirdPlaceMessagePayload): Promise<DiscordThirdPlaceSentMessage> => ({
        id: "third-place-message-1"
      })
    );
    const client = clientWithChannel({ send });

    await expect(
      upsertDiscordThirdPlaceMessageWithClient(config(), message(), null, client)
    ).resolves.toBe("third-place-message-1");
    expect(send).toHaveBeenCalledOnce();
  });
});

function clientWithChannel(input: {
  send: NonNullable<DiscordThirdPlaceChannel["send"]>;
  messages?: NonNullable<DiscordThirdPlaceChannel["messages"]>;
}): DiscordThirdPlaceClient {
  const discordChannel: DiscordThirdPlaceChannel = {
    isTextBased: () => true,
    send: input.send,
    ...(input.messages ? { messages: input.messages } : {})
  };

  return {
    login: vi.fn(async () => undefined),
    channels: {
      fetch: vi.fn(async () => discordChannel)
    },
    destroy: vi.fn(async () => undefined)
  };
}

function config() {
  return {
    discordToken: "token",
    guildId: "guild-1",
    channelId: "channel-1"
  } as Parameters<typeof upsertDiscordThirdPlaceMessageWithClient>[0];
}

function message(): ThirdPlaceDashboardMessage {
  return {
    content: "third places",
    embeds: [],
    files: [{ attachment: Buffer.from("png"), name: "copanalhas-third-places.png" }]
  };
}
