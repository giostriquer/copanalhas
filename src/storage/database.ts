import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import type { StandingsPostKey } from "../standings/format.js";
import type { WorldCupMatch } from "../worldcup/types.js";

export interface StoredPrediction {
  userId: string;
  matchId: string;
  messageId: string;
  homeScore: number;
  awayScore: number;
  submittedAt: string;
  updatedAt: string | null;
  parserVersion: string;
}

export interface StoredResult {
  matchId: string;
  homeScore: number;
  awayScore: number;
  recordedAt: string;
  resultSource: "manual" | "football-data";
  externalMatchId: string | null;
  fetchedAt: string | null;
}

export type PostedMatchCardSource = "auto" | "command";

export interface StoredPostedMatchCard {
  matchId: string;
  channelId: string;
  messageId: string;
  postedForDate: string;
  postedAt: string;
  postSource: PostedMatchCardSource;
}

export interface StoredStandingsPost {
  postKey: StandingsPostKey;
  guildId: string;
  channelId: string;
  messageId: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoredLeaderboardPost {
  guildId: string;
  channelId: string;
  messageId: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoredPredictionRevealPost {
  matchId: string;
  channelId: string;
  threadId: string;
  messageId: string;
  revealedAt: string;
  closeAtUtc: string;
}

export interface NewScoringRun {
  createdAt: string;
  matchId: string | null;
  summary: Record<string, unknown>;
}

export interface StoredScoringRun extends NewScoringRun {
  id: number;
}

export class CopanalhasDatabase {
  constructor(private readonly database: DatabaseSync) {}

  migrate(): void {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS matches (
        id TEXT PRIMARY KEY,
        match_number INTEGER NOT NULL UNIQUE,
        phase TEXT NOT NULL,
        group_name TEXT NOT NULL,
        home_team_code TEXT NOT NULL,
        home_team_name TEXT NOT NULL,
        away_team_code TEXT NOT NULL,
        away_team_name TEXT NOT NULL,
        local_date TEXT NOT NULL,
        kickoff_time_local TEXT,
        kickoff_at_utc TEXT,
        venue TEXT NOT NULL,
        source_id TEXT NOT NULL,
        football_data_match_id INTEGER
      ) STRICT;

      CREATE TABLE IF NOT EXISTS predictions (
        user_id TEXT NOT NULL,
        match_id TEXT NOT NULL,
        message_id TEXT NOT NULL,
        home_score INTEGER NOT NULL,
        away_score INTEGER NOT NULL,
        submitted_at TEXT NOT NULL,
        updated_at TEXT,
        parser_version TEXT NOT NULL,
        PRIMARY KEY (user_id, match_id)
      ) STRICT;

      CREATE TABLE IF NOT EXISTS results (
        match_id TEXT PRIMARY KEY,
        home_score INTEGER NOT NULL,
        away_score INTEGER NOT NULL,
        recorded_at TEXT NOT NULL,
        result_source TEXT NOT NULL,
        external_match_id TEXT,
        fetched_at TEXT
      ) STRICT;

      CREATE TABLE IF NOT EXISTS posted_match_cards (
        match_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        message_id TEXT NOT NULL,
        posted_for_date TEXT NOT NULL,
        posted_at TEXT NOT NULL,
        post_source TEXT NOT NULL,
        PRIMARY KEY (match_id, channel_id)
      ) STRICT;

      CREATE TABLE IF NOT EXISTS standings_posts (
        post_key TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        message_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (post_key, guild_id, channel_id)
      ) STRICT;

      CREATE TABLE IF NOT EXISTS leaderboard_posts (
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        message_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (guild_id, channel_id)
      ) STRICT;

      CREATE TABLE IF NOT EXISTS prediction_reveal_posts (
        match_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        thread_id TEXT NOT NULL,
        message_id TEXT NOT NULL,
        revealed_at TEXT NOT NULL,
        close_at_utc TEXT NOT NULL,
        PRIMARY KEY (match_id, channel_id)
      ) STRICT;

      CREATE TABLE IF NOT EXISTS scoring_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT NOT NULL,
        match_id TEXT,
        summary_json TEXT NOT NULL
      ) STRICT;
    `);

    this.ensureColumn("matches", "kickoff_at_utc", "TEXT");
    this.ensureColumn("matches", "football_data_match_id", "INTEGER");
    this.ensureColumn("results", "result_source", "TEXT NOT NULL DEFAULT 'manual'");
    this.ensureColumn("results", "external_match_id", "TEXT");
    this.ensureColumn("results", "fetched_at", "TEXT");
  }

  upsertMatches(matches: WorldCupMatch[]): void {
    const statement = this.database.prepare(`
      INSERT INTO matches (
        id,
        match_number,
        phase,
        group_name,
        home_team_code,
        home_team_name,
        away_team_code,
        away_team_name,
        local_date,
        kickoff_time_local,
        kickoff_at_utc,
        venue,
        source_id,
        football_data_match_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        match_number = excluded.match_number,
        phase = excluded.phase,
        group_name = excluded.group_name,
        home_team_code = excluded.home_team_code,
        home_team_name = excluded.home_team_name,
        away_team_code = excluded.away_team_code,
        away_team_name = excluded.away_team_name,
        local_date = excluded.local_date,
        kickoff_time_local = excluded.kickoff_time_local,
        kickoff_at_utc = excluded.kickoff_at_utc,
        venue = excluded.venue,
        source_id = excluded.source_id,
        football_data_match_id = excluded.football_data_match_id
    `);

    for (const match of matches) {
      statement.run(
        match.id,
        match.matchNumber,
        match.phase,
        match.group,
        match.homeTeam.code,
        match.homeTeam.name,
        match.awayTeam.code,
        match.awayTeam.name,
        match.localDate,
        match.kickoffTimeLocal,
        match.kickoffAtUtc,
        match.venue,
        match.sourceId,
        match.externalIds.footballData ?? null
      );
    }
  }

  listMatches(): WorldCupMatch[] {
    const rows = this.database
      .prepare("SELECT * FROM matches ORDER BY match_number")
      .all() as unknown as MatchRow[];

    return rows.map((row) => ({
      id: row.id,
      matchNumber: row.match_number,
      phase: "group",
      group: row.group_name,
      homeTeam: {
        code: row.home_team_code,
        name: row.home_team_name
      },
      awayTeam: {
        code: row.away_team_code,
        name: row.away_team_name
      },
      localDate: row.local_date,
      kickoffTimeLocal: row.kickoff_time_local,
      kickoffAtUtc: row.kickoff_at_utc,
      venue: row.venue,
      sourceId: row.source_id,
      externalIds: row.football_data_match_id ? { footballData: row.football_data_match_id } : {}
    }));
  }

  upsertPrediction(prediction: StoredPrediction): void {
    this.database
      .prepare(`
        INSERT INTO predictions (
          user_id,
          match_id,
          message_id,
          home_score,
          away_score,
          submitted_at,
          updated_at,
          parser_version
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, match_id) DO UPDATE SET
          message_id = excluded.message_id,
          home_score = excluded.home_score,
          away_score = excluded.away_score,
          submitted_at = excluded.submitted_at,
          updated_at = excluded.updated_at,
          parser_version = excluded.parser_version
      `)
      .run(
        prediction.userId,
        prediction.matchId,
        prediction.messageId,
        prediction.homeScore,
        prediction.awayScore,
        prediction.submittedAt,
        prediction.updatedAt,
        prediction.parserVersion
      );
  }

  listPredictions(): StoredPrediction[] {
    const rows = this.database
      .prepare("SELECT * FROM predictions ORDER BY match_id, user_id")
      .all() as unknown as PredictionRow[];

    return rows.map((row) => ({
      userId: row.user_id,
      matchId: row.match_id,
      messageId: row.message_id,
      homeScore: row.home_score,
      awayScore: row.away_score,
      submittedAt: row.submitted_at,
      updatedAt: row.updated_at,
      parserVersion: row.parser_version
    }));
  }

  upsertResult(result: StoredResult): void {
    this.database
      .prepare(`
        INSERT INTO results (
          match_id,
          home_score,
          away_score,
          recorded_at,
          result_source,
          external_match_id,
          fetched_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(match_id) DO UPDATE SET
          home_score = excluded.home_score,
          away_score = excluded.away_score,
          recorded_at = excluded.recorded_at,
          result_source = excluded.result_source,
          external_match_id = excluded.external_match_id,
          fetched_at = excluded.fetched_at
      `)
      .run(
        result.matchId,
        result.homeScore,
        result.awayScore,
        result.recordedAt,
        result.resultSource,
        result.externalMatchId,
        result.fetchedAt
      );
  }

  listResults(): StoredResult[] {
    const rows = this.database
      .prepare("SELECT * FROM results ORDER BY match_id")
      .all() as unknown as ResultRow[];

    return rows.map((row) => ({
      matchId: row.match_id,
      homeScore: row.home_score,
      awayScore: row.away_score,
      recordedAt: row.recorded_at,
      resultSource: row.result_source,
      externalMatchId: row.external_match_id,
      fetchedAt: row.fetched_at
    }));
  }

  recordPostedMatchCard(card: StoredPostedMatchCard): void {
    this.database
      .prepare(`
        INSERT INTO posted_match_cards (
          match_id,
          channel_id,
          message_id,
          posted_for_date,
          posted_at,
          post_source
        )
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(match_id, channel_id) DO UPDATE SET
          message_id = excluded.message_id,
          posted_for_date = excluded.posted_for_date,
          posted_at = excluded.posted_at,
          post_source = excluded.post_source
      `)
      .run(
        card.matchId,
        card.channelId,
        card.messageId,
        card.postedForDate,
        card.postedAt,
        card.postSource
      );
  }

  listPostedMatchCards(): StoredPostedMatchCard[] {
    const rows = this.database
      .prepare("SELECT * FROM posted_match_cards ORDER BY posted_for_date, channel_id, match_id")
      .all() as unknown as PostedMatchCardRow[];

    return rows.map((row) => ({
      matchId: row.match_id,
      channelId: row.channel_id,
      messageId: row.message_id,
      postedForDate: row.posted_for_date,
      postedAt: row.posted_at,
      postSource: row.post_source
    }));
  }

  clearPostedMatchCardsForDate(channelId: string, postedForDate: string): number {
    const result = this.database
      .prepare("DELETE FROM posted_match_cards WHERE channel_id = ? AND posted_for_date = ?")
      .run(channelId, postedForDate);

    return Number(result.changes);
  }

  clearPredictionsForMatches(matchIds: readonly string[]): number {
    return this.clearRowsForMatches("predictions", matchIds);
  }

  clearResultsForMatches(matchIds: readonly string[]): number {
    return this.clearRowsForMatches("results", matchIds);
  }

  recordPredictionRevealPost(post: StoredPredictionRevealPost): void {
    this.database
      .prepare(`
        INSERT INTO prediction_reveal_posts (
          match_id,
          channel_id,
          thread_id,
          message_id,
          revealed_at,
          close_at_utc
        )
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(match_id, channel_id) DO UPDATE SET
          thread_id = excluded.thread_id,
          message_id = excluded.message_id,
          revealed_at = excluded.revealed_at,
          close_at_utc = excluded.close_at_utc
      `)
      .run(
        post.matchId,
        post.channelId,
        post.threadId,
        post.messageId,
        post.revealedAt,
        post.closeAtUtc
      );
  }

  listPredictionRevealPosts(): StoredPredictionRevealPost[] {
    const rows = this.database
      .prepare("SELECT * FROM prediction_reveal_posts ORDER BY channel_id, match_id")
      .all() as unknown as PredictionRevealPostRow[];

    return rows.map((row) => ({
      matchId: row.match_id,
      channelId: row.channel_id,
      threadId: row.thread_id,
      messageId: row.message_id,
      revealedAt: row.revealed_at,
      closeAtUtc: row.close_at_utc
    }));
  }

  clearPredictionRevealPostsForMatches(matchIds: readonly string[]): number {
    return this.clearRowsForMatches("prediction_reveal_posts", matchIds);
  }

  recordStandingsPost(post: StoredStandingsPost): void {
    this.database
      .prepare(`
        INSERT INTO standings_posts (
          post_key,
          guild_id,
          channel_id,
          message_id,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(post_key, guild_id, channel_id) DO UPDATE SET
          message_id = excluded.message_id,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at
      `)
      .run(
        post.postKey,
        post.guildId,
        post.channelId,
        post.messageId,
        post.createdAt,
        post.updatedAt
      );
  }

  listStandingsPosts(): StoredStandingsPost[] {
    const rows = this.database
      .prepare("SELECT * FROM standings_posts ORDER BY post_key, guild_id, channel_id")
      .all() as unknown as StandingsPostRow[];

    return rows.map((row) => ({
      postKey: row.post_key,
      guildId: row.guild_id,
      channelId: row.channel_id,
      messageId: row.message_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  recordLeaderboardPost(post: StoredLeaderboardPost): void {
    this.database
      .prepare(`
        INSERT INTO leaderboard_posts (
          guild_id,
          channel_id,
          message_id,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(guild_id, channel_id) DO UPDATE SET
          message_id = excluded.message_id,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at
      `)
      .run(post.guildId, post.channelId, post.messageId, post.createdAt, post.updatedAt);
  }

  listLeaderboardPosts(): StoredLeaderboardPost[] {
    const rows = this.database
      .prepare("SELECT * FROM leaderboard_posts ORDER BY guild_id, channel_id")
      .all() as unknown as LeaderboardPostRow[];

    return rows.map((row) => ({
      guildId: row.guild_id,
      channelId: row.channel_id,
      messageId: row.message_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  insertScoringRun(run: NewScoringRun): StoredScoringRun {
    const result = this.database
      .prepare("INSERT INTO scoring_runs (created_at, match_id, summary_json) VALUES (?, ?, ?)")
      .run(run.createdAt, run.matchId, JSON.stringify(run.summary));

    return {
      id: Number(result.lastInsertRowid),
      ...run
    };
  }

  listScoringRuns(): StoredScoringRun[] {
    const rows = this.database
      .prepare("SELECT * FROM scoring_runs ORDER BY id")
      .all() as unknown as ScoringRunRow[];

    return rows.map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      matchId: row.match_id,
      summary: JSON.parse(row.summary_json) as Record<string, unknown>
    }));
  }

  close(): void {
    this.database.close();
  }

  private ensureColumn(tableName: string, columnName: string, columnType: string): void {
    const columns = this.database.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{
      name: string;
    }>;

    if (!columns.some((column) => column.name === columnName)) {
      this.database.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnType}`);
    }
  }

  private clearRowsForMatches(
    tableName: "predictions" | "results" | "prediction_reveal_posts",
    matchIds: readonly string[]
  ): number {
    if (matchIds.length === 0) {
      return 0;
    }

    const placeholders = matchIds.map(() => "?").join(", ");
    const result = this.database
      .prepare(`DELETE FROM ${tableName} WHERE match_id IN (${placeholders})`)
      .run(...matchIds);

    return Number(result.changes);
  }
}

export function openCopanalhasDatabase(path: string): CopanalhasDatabase {
  if (path !== ":memory:") {
    const parentDirectory = dirname(path);

    if (parentDirectory !== ".") {
      mkdirSync(parentDirectory, { recursive: true });
    }
  }

  return new CopanalhasDatabase(new DatabaseSync(path));
}

interface MatchRow {
  id: string;
  match_number: number;
  group_name: string;
  home_team_code: string;
  home_team_name: string;
  away_team_code: string;
  away_team_name: string;
  local_date: string;
  kickoff_time_local: string | null;
  kickoff_at_utc: string | null;
  venue: string;
  source_id: string;
  football_data_match_id: number | null;
}

interface PredictionRow {
  user_id: string;
  match_id: string;
  message_id: string;
  home_score: number;
  away_score: number;
  submitted_at: string;
  updated_at: string | null;
  parser_version: string;
}

interface ResultRow {
  match_id: string;
  home_score: number;
  away_score: number;
  recorded_at: string;
  result_source: "manual" | "football-data";
  external_match_id: string | null;
  fetched_at: string | null;
}

interface PostedMatchCardRow {
  match_id: string;
  channel_id: string;
  message_id: string;
  posted_for_date: string;
  posted_at: string;
  post_source: PostedMatchCardSource;
}

interface StandingsPostRow {
  post_key: StandingsPostKey;
  guild_id: string;
  channel_id: string;
  message_id: string;
  created_at: string;
  updated_at: string;
}

interface LeaderboardPostRow {
  guild_id: string;
  channel_id: string;
  message_id: string;
  created_at: string;
  updated_at: string;
}

interface PredictionRevealPostRow {
  match_id: string;
  channel_id: string;
  thread_id: string;
  message_id: string;
  revealed_at: string;
  close_at_utc: string;
}

interface ScoringRunRow {
  id: number;
  created_at: string;
  match_id: string | null;
  summary_json: string;
}
