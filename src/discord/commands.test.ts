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
        expect.objectContaining({ name: "clear-posted-date" }),
        expect.objectContaining({ name: "reset-test-date" }),
        expect.objectContaining({ name: "status" }),
        expect.objectContaining({ name: "standings" }),
        expect.objectContaining({ name: "leaderboard" }),
        expect.objectContaining({ name: "bracket" }),
        expect.objectContaining({ name: "third-places" }),
        expect.objectContaining({ name: "copanalhas-recap-painel" }),
        expect.objectContaining({ name: "sync-results" }),
        expect.objectContaining({ name: "meus-palpites" }),
        expect.objectContaining({ name: "predictions" }),
        expect.objectContaining({ name: "reveal" }),
        expect.objectContaining({ name: "repost-reveal" }),
        expect.objectContaining({ name: "result" })
      ])
    });
    expect(copanalhasCommandName).toBe("copanalhas");
  });

  test("enables autocomplete for match-based operator commands", () => {
    const command = createCopanalhasCommand().toJSON();
    const matchSubcommands = command.options?.filter((option) =>
      ["predictions", "reveal", "repost-reveal", "result"].includes(option.name)
    );

    expect(matchSubcommands).toHaveLength(4);
    for (const subcommand of matchSubcommands ?? []) {
      expect((subcommand as { options?: unknown[] }).options).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: "match",
            autocomplete: true
          })
        ])
      );
    }
  });

  test("defines optional Copanalhas Recap period choices", () => {
    const command = createCopanalhasCommand().toJSON();
    const recapSubcommand = command.options?.find(
      (option) => option.name === "copanalhas-recap-painel"
    ) as { options?: Array<{ name: string; required?: boolean; choices?: unknown[] }> } | undefined;

    expect(recapSubcommand?.options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "period",
          required: false,
          choices: expect.arrayContaining([
            { name: "Fase de grupos - semana 1", value: "group-week-1" },
            { name: "Fase de grupos - semana 2", value: "group-week-2" },
            { name: "Fase de grupos - semana 3", value: "group-week-3" }
          ])
        })
      ])
    );
  });

  test("defines optional detailed knockout result fields", () => {
    const command = createCopanalhasCommand().toJSON();
    const resultSubcommand = command.options?.find((option) => option.name === "result") as
      | { options?: Array<{ name: string; required?: boolean; choices?: unknown[] }> }
      | undefined;

    expect(resultSubcommand?.options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "decision",
          required: false,
          choices: [
            { name: "Tempo regulamentar", value: "regular" },
            { name: "Prorrogação", value: "extra_time" },
            { name: "Cobrança de pênaltis", value: "penalties" }
          ]
        }),
        expect.objectContaining({ name: "regular-score", required: false }),
        expect.objectContaining({ name: "extra-score", required: false }),
        expect.objectContaining({ name: "penalties-score", required: false }),
        expect.objectContaining({
          name: "winner",
          required: false,
          choices: [
            { name: "Mandante", value: "home" },
            { name: "Visitante", value: "away" }
          ]
        })
      ])
    );
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
