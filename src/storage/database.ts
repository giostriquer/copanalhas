import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

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
        venue TEXT NOT NULL,
        source_id TEXT NOT NULL
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
        recorded_at TEXT NOT NULL
      ) STRICT;

      CREATE TABLE IF NOT EXISTS scoring_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT NOT NULL,
        match_id TEXT,
        summary_json TEXT NOT NULL
      ) STRICT;
    `);
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
        venue,
        source_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        venue = excluded.venue,
        source_id = excluded.source_id
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
        match.venue,
        match.sourceId
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
      venue: row.venue,
      sourceId: row.source_id
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
        INSERT INTO results (match_id, home_score, away_score, recorded_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(match_id) DO UPDATE SET
          home_score = excluded.home_score,
          away_score = excluded.away_score,
          recorded_at = excluded.recorded_at
      `)
      .run(result.matchId, result.homeScore, result.awayScore, result.recordedAt);
  }

  listResults(): StoredResult[] {
    const rows = this.database
      .prepare("SELECT * FROM results ORDER BY match_id")
      .all() as unknown as ResultRow[];

    return rows.map((row) => ({
      matchId: row.match_id,
      homeScore: row.home_score,
      awayScore: row.away_score,
      recordedAt: row.recorded_at
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
  venue: string;
  source_id: string;
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
}

interface ScoringRunRow {
  id: number;
  created_at: string;
  match_id: string | null;
  summary_json: string;
}
