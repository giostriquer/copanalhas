import { describe, expect, test, vi } from "vitest";

import {
  copanalhasCommandName,
  createCopanalhasCommand,
  registerCopanalhasCommands
} from "./commands.js";

describe("Copanalhas slash command definition", () => {
  test("defines operator subcommands", () => {
    expect(createCopanalhasCommand().toJSON()).toMatchObject({
      name: "copanalhas",
      description: "Operate the Copanalhas World Cup game",
      options: expect.arrayContaining([
        expect.objectContaining({ name: "post-today" }),
        expect.objectContaining({ name: "post-date" }),
        expect.objectContaining({ name: "status" }),
        expect.objectContaining({ name: "standings" }),
        expect.objectContaining({ name: "leaderboard" }),
        expect.objectContaining({ name: "result" })
      ])
    });
    expect(copanalhasCommandName).toBe("copanalhas");
  });

  test("registers commands on the configured guild", async () => {
    const set = vi.fn(async () => undefined);

    await registerCopanalhasCommands({
      guildId: "guild-1",
      fetchGuild: async (guildId) => ({ id: guildId, commands: { set } })
    });

    expect(set).toHaveBeenCalledWith([createCopanalhasCommand().toJSON()]);
  });
});
