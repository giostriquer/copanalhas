import { describe, expect, test, vi } from "vitest";
import { ThreadAutoArchiveDuration } from "discord.js";

import {
  editPredictionRevealWithClient,
  postPredictionRevealWithClient,
  type DiscordPredictionRevealClient
} from "./prediction-reveal-posting.js";
import type { CopanalhasConfig } from "./config.js";

describe("postPredictionRevealWithClient", () => {
  test("reuses an existing matchday thread and disables mentions", async () => {
    const setArchived = vi.fn(async () => undefined);
    const send = vi.fn(async () => ({ id: "reveal-message-1" }));
    const client = clientWithParentMessage({
      thread: {
        id: "thread-1",
        archived: true,
        setArchived,
        send
      }
    });

    await expect(
      postPredictionRevealWithClient(config(), message(), client)
    ).resolves.toEqual({
      threadId: "thread-1",
      messageId: "reveal-message-1"
    });

    expect(setArchived).toHaveBeenCalledWith(false);
    expect(send).toHaveBeenCalledWith({
      content: "Palpites encerrados",
      allowedMentions: { parse: [] }
    });
    expect(client.destroy).toHaveBeenCalledOnce();
  });

  test("starts a thread from the matchday message when none exists", async () => {
    const send = vi.fn(async () => ({ id: "reveal-message-2" }));
    const startThread = vi.fn(async () => ({
      id: "thread-2",
      send
    }));
    const client = clientWithParentMessage({ startThread });

    await expect(
      postPredictionRevealWithClient(config(), message(), client)
    ).resolves.toEqual({
      threadId: "thread-2",
      messageId: "reveal-message-2"
    });

    expect(startThread).toHaveBeenCalledWith({
      name: "Palpites 2026-06-11",
      autoArchiveDuration: ThreadAutoArchiveDuration.OneDay,
      reason: "Post locked Copanalhas predictions"
    });
  });
});

describe("editPredictionRevealWithClient", () => {
  test("edits a stored reveal message in its thread and disables mentions", async () => {
    const edit = vi.fn(async () => undefined);
    const client: DiscordPredictionRevealClient = {
      login: vi.fn(async () => undefined),
      channels: {
        fetch: vi.fn(async () => ({
          id: "thread-1",
          isTextBased: () => true,
          send: vi.fn(async () => ({ id: "unused" })),
          messages: {
            fetch: vi.fn(async () => ({ edit }))
          }
        }))
      },
      destroy: vi.fn(async () => undefined)
    };

    await editPredictionRevealWithClient(
      config(),
      {
        threadId: "thread-1",
        messageId: "reveal-message-1",
        content: "Resultado"
      },
      client
    );

    expect(edit).toHaveBeenCalledWith({
      content: "Resultado",
      allowedMentions: { parse: [] }
    });
    expect(client.destroy).toHaveBeenCalledOnce();
  });
});

function clientWithParentMessage(parentMessage: {
  thread?: {
    id: string;
    archived?: boolean;
    setArchived?: (archived: boolean) => Promise<unknown>;
    send(message: { content: string; allowedMentions: { parse: [] } }): Promise<{ id: string }>;
  } | null;
  startThread?: (options: {
    name: string;
    autoArchiveDuration: ThreadAutoArchiveDuration;
    reason: string;
  }) => Promise<{
    id: string;
    send(message: { content: string; allowedMentions: { parse: [] } }): Promise<{ id: string }>;
  }>;
}): DiscordPredictionRevealClient {
  return {
    login: vi.fn(async () => undefined),
    channels: {
      fetch: vi.fn(async () => ({
        isTextBased: () => true,
        messages: {
          fetch: vi.fn(async () => parentMessage)
        }
      }))
    },
    destroy: vi.fn(async () => undefined)
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
    timezone: "America/Sao_Paulo",
    matchdayRolloverTime: "06:00",
    footballDataToken: null,
    resultSyncEnabled: false,
    resultSyncFirstCheckMinutes: 135,
    resultSyncRetryMinutes: 30
  };
}

function message() {
  return {
    parentMessageId: "matchday-message-1",
    threadName: "Palpites 2026-06-11",
    content: "Palpites encerrados"
  };
}
