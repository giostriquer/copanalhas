import type { LeaderboardRow } from "../scoring/scoring.js";

export interface ChaosDashboardModel {
  title: "Copanalhas Recap";
  generatedAtLabel: string;
  week: ChaosWeek;
  totals: ChaosTotals;
  leaderboardTop: ChaosLeaderboardRow[];
  weeklyMovement: ChaosWeeklyMovement;
  peopleAwards: ChaosPeopleAward[];
  matchAwards: ChaosMatchAward[];
  footer: string;
}

export interface ChaosWeek {
  start: string;
  end: string;
  label: string;
}

export interface ChaosTotals {
  scoredMatches: number;
  predictions: number;
  finishedPredictions: number;
}

export interface ChaosLeaderboardRow extends LeaderboardRow {
  rank: number;
  displayName: string;
}

export interface ChaosWeeklySnapshotRow {
  userId: string;
  rank: number;
  points: number;
  soloCount: number;
  exactCount: number;
  outcomeCount: number;
  closestCount: number;
}

export type ChaosWeeklyMovement =
  | { status: "no-history"; message: string }
  | {
      status: "ready";
      climbers: ChaosMovementRow[];
      fallers: ChaosMovementRow[];
      newcomers: ChaosMovementRow[];
    };

export interface ChaosMovementRow {
  userId: string;
  displayName: string;
  rank: number;
  previousRank: number | null;
  movement: number;
  points: number;
}

export interface ChaosPeopleAward {
  key: string;
  title: string;
  subject: string;
  value: string;
  subtitle: string;
}

export interface ChaosMatchAward {
  key: string;
  title: string;
  matchLabel: string;
  value: string;
  subtitle: string;
}
