export interface TournamentSeed {
  schemaVersion: 1;
  tournamentId: "fifa-world-cup-2026";
  importedAt: string;
  sources: TournamentDataSource[];
  matches: WorldCupMatch[];
}

export interface TournamentDataSource {
  id: string;
  title: string;
  url: string;
  accessedAt: string;
  notes: string;
}

export type WorldCupPhase =
  | "group"
  | "round_of_32"
  | "round_of_16"
  | "quarter_final"
  | "semi_final"
  | "third_place"
  | "final";

export type WorldCupMatch = WorldCupGroupMatch | WorldCupKnockoutMatch;

interface WorldCupMatchBase {
  id: string;
  matchNumber: number;
  phase: WorldCupPhase;
  homeTeam: WorldCupTeam;
  awayTeam: WorldCupTeam;
  localDate: string;
  kickoffTimeLocal: string | null;
  kickoffAtUtc: string | null;
  venue: string;
  sourceId: string;
  externalIds: WorldCupExternalIds;
}

export interface WorldCupGroupMatch extends WorldCupMatchBase {
  phase: "group";
  group: string;
}

export interface WorldCupKnockoutMatch extends WorldCupMatchBase {
  phase: Exclude<WorldCupPhase, "group">;
  group: null;
}

export interface WorldCupTeam {
  code: string;
  name: string;
}

export interface WorldCupExternalIds {
  footballData?: number;
}

export function isGroupStageMatch(match: WorldCupMatch): match is WorldCupGroupMatch {
  return match.phase === "group";
}
