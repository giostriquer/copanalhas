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

export interface WorldCupMatch {
  id: string;
  matchNumber: number;
  phase: "group";
  group: string;
  homeTeam: WorldCupTeam;
  awayTeam: WorldCupTeam;
  localDate: string;
  kickoffTimeLocal: string | null;
  venue: string;
  sourceId: string;
}

export interface WorldCupTeam {
  code: string;
  name: string;
}
