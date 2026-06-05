import { SlashCommandBuilder, type ApplicationCommandDataResolvable } from "discord.js";

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
      subcommand.setName("status").setDescription("Show Copanalhas operator status")
    )
    .addSubcommand((subcommand) =>
      subcommand.setName("standings").setDescription("Post or update group standings")
    )
    .addSubcommand((subcommand) =>
      subcommand.setName("leaderboard").setDescription("Show the current leaderboard")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("predictions")
        .setDescription("Privately inspect predictions for one match")
        .addStringOption((option) =>
          option.setName("match").setDescription("Match id, like wc2026-001").setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("reveal")
        .setDescription("Publicly reveal locked predictions for one match")
        .addStringOption((option) =>
          option.setName("match").setDescription("Match id, like wc2026-001").setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("result")
        .setDescription("Record or override a match result")
        .addStringOption((option) =>
          option.setName("match").setDescription("Match id, like wc2026-001").setRequired(true)
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
