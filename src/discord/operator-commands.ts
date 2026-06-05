import { MessageFlags, type ChatInputCommandInteraction, type Interaction } from "discord.js";

import type { PostDueMatchCardsResult } from "../app/match-card-posting.js";
import { getLocalDateTimeParts } from "../app/scheduler.js";
import { formatLeaderboard } from "../leaderboard/format.js";
import { parseScoreInput } from "../predictions/score-parser.js";
import { buildLeaderboard, scoreMatch, type MatchResult, type ScorePrediction } from "../scoring/scoring.js";
import type {
  PostedMatchCardSource,
  StoredResult,
  StoredStandingsPost
} from "../storage/database.js";
import type { WorldCupMatch } from "../worldcup/types.js";
import type { UpdateStandingsDashboardResult } from "../app/standings-posting.js";
import { copanalhasCommandName } from "./commands.js";

export type OperatorSubcommand =
  | "post-today"
  | "post-date"
  | "status"
  | "standings"
  | "leaderboard"
  | "result";

export interface OperatorCommandInput {
  guildId: string | null;
  channelId: string | null;
  userId: string;
  subcommand: OperatorSubcommand;
  options: Record<string, string>;
}

export interface OperatorCommandOptions {
  guildId: string;
  channelId: string;
  matches: WorldCupMatch[];
  timeZone: string;
  resultSyncEnabled: boolean;
  now(): Date;
  postDueMatchCards(date: string, postSource: PostedMatchCardSource): Promise<PostDueMatchCardsResult>;
  listPredictions(): ScorePrediction[];
  listResults(): MatchResult[];
  upsertResult(result: StoredResult): void | Promise<void>;
  listStandingsPosts(): StoredStandingsPost[];
  updateStandingsDashboard(): Promise<UpdateStandingsDashboardResult>;
}

export type OperatorCommandResult =
  | { action: "ignored"; reason: "wrong-guild" | "wrong-channel" | "unknown-command" }
  | { action: "replied"; content: string; ephemeral: true };

export async function handleOperatorCommand(
  command: OperatorCommandInput,
  options: OperatorCommandOptions
): Promise<OperatorCommandResult> {
  if (command.guildId !== options.guildId) {
    return { action: "ignored", reason: "wrong-guild" };
  }

  if (command.channelId !== options.channelId) {
    return { action: "ignored", reason: "wrong-channel" };
  }

  if (command.subcommand === "post-today") {
    const { localDate } = getLocalDateTimeParts(options.now(), options.timeZone);
    return postForDate(localDate, options);
  }

  if (command.subcommand === "post-date") {
    const date = command.options.date;

    if (!isDateString(date)) {
      return reply("Use a date like 2026-06-11.");
    }

    return postForDate(date, options);
  }

  if (command.subcommand === "status") {
    return reply(
      [
        "Copanalhas Status",
        `Matches loaded: ${options.matches.length}`,
        `Missing kickoff times: ${options.matches.filter((match) => !match.kickoffAtUtc).length}`,
        `Result sync: ${options.resultSyncEnabled ? "on" : "off"}`,
        ...formatStandingsStatus(options.listStandingsPosts(), options.guildId, options.channelId)
      ].join("\n")
    );
  }

  if (command.subcommand === "standings") {
    const result = await options.updateStandingsDashboard();

    return reply(`Updated standings dashboard: ${result.posts.length} posts.`);
  }

  if (command.subcommand === "leaderboard") {
    const scoredPredictions = options
      .listResults()
      .flatMap((result) => scoreMatch(result, options.listPredictions()));

    return reply(formatLeaderboard(buildLeaderboard(scoredPredictions)));
  }

  if (command.subcommand === "result") {
    const matchId = command.options.match;
    const match = options.matches.find((candidate) => candidate.id === matchId);

    if (!match) {
      return reply(`Unknown match ${matchId}.`);
    }

    const parsedScore = parseScoreInput(command.options.score ?? "");

    if (!parsedScore.ok) {
      return reply("Use a score like 2x1 or 2-1.");
    }

    await options.upsertResult({
      matchId: match.id,
      homeScore: parsedScore.score.homeScore,
      awayScore: parsedScore.score.awayScore,
      recordedAt: options.now().toISOString(),
      resultSource: "manual",
      externalMatchId: null,
      fetchedAt: null
    });
    await options.updateStandingsDashboard();

    return reply(`Recorded result ${match.id} ${parsedScore.score.normalizedText}.`);
  }

  return { action: "ignored", reason: "unknown-command" };
}

export async function handleDiscordOperatorCommand(
  interaction: Interaction,
  options: OperatorCommandOptions
): Promise<OperatorCommandResult> {
  if (!interaction.isChatInputCommand() || interaction.commandName !== copanalhasCommandName) {
    return { action: "ignored", reason: "unknown-command" };
  }

  const subcommand = parseOperatorSubcommand(interaction.options.getSubcommand(true));

  if (!subcommand) {
    return { action: "ignored", reason: "unknown-command" };
  }

  const result = await handleOperatorCommand(
    {
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      userId: interaction.user.id,
      subcommand,
      options: readCommandOptions(subcommand, interaction)
    },
    options
  );

  if (result.action === "replied") {
    await interaction.reply({
      content: result.content,
      flags: MessageFlags.Ephemeral
    });
  }

  return result;
}

async function postForDate(
  date: string,
  options: OperatorCommandOptions
): Promise<OperatorCommandResult> {
  const result = await options.postDueMatchCards(date, "command");

  return reply(
    `Posted ${result.posted.length} ${count(
      result.posted.length,
      "match card",
      "match cards"
    )} for ${date}. Skipped ${result.skipped.length} already posted.`
  );
}

function readCommandOptions(
  subcommand: OperatorSubcommand,
  interaction: ChatInputCommandInteraction
): Record<string, string> {
  if (subcommand === "post-date") {
    return {
      date: interaction.options.getString("date", true)
    };
  }

  if (subcommand === "result") {
    return {
      match: interaction.options.getString("match", true),
      score: interaction.options.getString("score", true)
    };
  }

  return {};
}

function parseOperatorSubcommand(value: string): OperatorSubcommand | undefined {
  if (
    value === "post-today" ||
    value === "post-date" ||
    value === "status" ||
    value === "standings" ||
    value === "leaderboard" ||
    value === "result"
  ) {
    return value;
  }

  return undefined;
}

function reply(content: string): OperatorCommandResult {
  return {
    action: "replied",
    content,
    ephemeral: true
  };
}

function isDateString(value: string | undefined): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/u.test(value);
}

function count(value: number, singular: string, plural: string): string {
  return value === 1 ? singular : plural;
}

function formatStandingsStatus(
  posts: StoredStandingsPost[],
  guildId: string,
  channelId: string
): string[] {
  const matchingPosts = posts.filter(
    (post) => post.guildId === guildId && post.channelId === channelId
  );
  const latestUpdatedAt = matchingPosts
    .map((post) => post.updatedAt)
    .sort()
    .at(-1);

  return [
    `Standings posts: ${matchingPosts.length}/2`,
    `Standings last updated: ${latestUpdatedAt ?? "never"}`
  ];
}
