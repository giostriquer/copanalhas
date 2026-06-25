import { SlashCommandBuilder, type ApplicationCommandDataResolvable } from "discord.js";

import { chaosRecapPeriodChoices } from "../chaos-dashboard/periods.js";

export const copanalhasCommandName = "copanalhas";

export interface CopanalhasCommandGuild {
  id: string;
  commands: {
    set(commands: readonly ApplicationCommandDataResolvable[]): Promise<unknown>;
  };
}

export interface RegisterCopanalhasCommandsOptions {
  guildId: string;
  fetchGuild(guildId: string): Promise<CopanalhasCommandGuild>;
}

export function createCopanalhasCommand() {
  return new SlashCommandBuilder()
    .setName(copanalhasCommandName)
    .setDescription("Operate the Copanalhas World Cup game")
    .addSubcommand((subcommand) =>
      subcommand.setName("post-today").setDescription("Post today's match cards")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("post-date")
        .setDescription("Post match cards for a specific date")
        .addStringOption((option) =>
          option
            .setName("date")
            .setDescription("Date to post in YYYY-MM-DD format")
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("clear-posted-date")
        .setDescription("Clear posted-card records for a test date")
        .addStringOption((option) =>
          option
            .setName("date")
            .setDescription("Date to clear in YYYY-MM-DD format")
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("reset-test-date")
        .setDescription("Clear test data for one matchday")
        .addStringOption((option) =>
          option
            .setName("date")
            .setDescription("Date to reset in YYYY-MM-DD format")
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand.setName("status").setDescription("Show Copanalhas operator status")
    )
    .addSubcommand((subcommand) =>
      subcommand.setName("standings").setDescription("Post or update group standings")
    )
    .addSubcommand((subcommand) =>
      subcommand.setName("leaderboard").setDescription("Show the current leaderboard")
    )
    .addSubcommand((subcommand) =>
      subcommand.setName("bracket").setDescription("Post or update the World Cup bracket")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("third-places")
        .setDescription("Post or update the third-place qualification table")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("copanalhas-recap-painel")
        .setDescription("Post or update the Copanalhas Recap")
        .addStringOption((option) =>
          option
            .setName("period")
            .setDescription("Week or period to refresh; omit to refresh all completed recaps")
            .setRequired(false)
            .addChoices(
              ...chaosRecapPeriodChoices.map((period) => ({
                name: period.label,
                value: period.key
              }))
            )
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("sync-results")
        .setDescription("Force an immediate Football Data result sync")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("meus-palpites")
        .setDescription("Show your predictions for one matchday")
        .addStringOption((option) =>
          option
            .setName("date")
            .setDescription("Date to inspect in YYYY-MM-DD format; defaults to today")
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("predictions")
        .setDescription("Privately inspect predictions for one match")
        .addStringOption((option) =>
          option
            .setName("match")
            .setDescription("Search by match number or team")
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("reveal")
        .setDescription("Publicly reveal locked predictions for one match")
        .addStringOption((option) =>
          option
            .setName("match")
            .setDescription("Search by match number or team")
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("repost-reveal")
        .setDescription("Repost a locked prediction reveal after deleting a stale thread message")
        .addStringOption((option) =>
          option
            .setName("match")
            .setDescription("Search by match number or team")
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("result")
        .setDescription("Record or override a match result")
        .addStringOption((option) =>
          option
            .setName("match")
            .setDescription("Search by match number or team")
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addStringOption((option) =>
          option.setName("score").setDescription("Final score, like 2-1").setRequired(true)
        )
    );
}

export async function registerCopanalhasCommands(
  options: RegisterCopanalhasCommandsOptions
): Promise<void> {
  const guild = await options.fetchGuild(options.guildId);

  await guild.commands.set([createCopanalhasCommand().toJSON()]);
}
