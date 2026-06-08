import { describe, expect, test, vi } from "vitest";

import {
  fetchDiscordDisplayNamesWithClient,
  type DiscordDisplayNameClient,
  type DiscordDisplayNameGuildMember
} from "./display-names.js";
import type { CopanalhasConfig } from "./config.js";

describe("fetchDiscordDisplayNamesWithClient", () => {
  test("fetches guild member display names and falls back to ids for missing members", async () => {
    const fetchMember = vi.fn(async (userId: string): Promise<DiscordDisplayNameGuildMember> => {
      if (userId === "user-1") {
        return {
          displayName: "Giova"
        };
      }

      if (userId === "user-2") {
        return {
          displayName: "",
          user: {
            displayName: "Ana Global",
            username: "ana"
          }
        };
      }

      throw new Error("member not found");
    });
    const client: DiscordDisplayNameClient = {
      login: vi.fn(async () => undefined),
      guilds: {
        fetch: vi.fn(async () => ({
          members: {
            fetch: fetchMember
          }
        }))
      },
      destroy: vi.fn(async () => undefined)
    };

    await expect(
      fetchDiscordDisplayNamesWithClient(config(), ["user-1", "user-2", "missing-user"], client)
    ).resolves.toEqual(
      new Map([
        ["user-1", "Giova"],
        ["user-2", "Ana Global"],
        ["missing-user", "missing-user"]
      ])
    );

    expect(client.login).toHaveBeenCalledWith("token-value");
    expect(client.guilds.fetch).toHaveBeenCalledWith("guild-1");
    expect(fetchMember).toHaveBeenCalledWith("user-1");
    expect(fetchMember).toHaveBeenCalledWith("user-2");
    expect(fetchMember).toHaveBeenCalledWith("missing-user");
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
    matchdayRolloverTime: "06:00",
    footballDataToken: null,
    resultSyncEnabled: false,
    resultSyncFirstCheckMinutes: 135,
    resultSyncRetryMinutes: 30
  };
}
