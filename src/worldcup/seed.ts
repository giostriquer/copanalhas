import type { TournamentSeed, WorldCupMatch } from "./types.js";

const fifaScheduleSourceId = "fifa-schedule-2026-03-31";

export const WORLD_CUP_2026_SEED: TournamentSeed = {
  schemaVersion: 1,
  tournamentId: "fifa-world-cup-2026",
  importedAt: "2026-06-05",
  sources: [
    {
      id: fifaScheduleSourceId,
      title: "View the FIFA World Cup 2026 match schedule",
      url: "https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/match-schedule-fixtures-results-teams-stadiums",
      accessedAt: "2026-06-05",
      notes:
        "Reviewed opening group-stage subset from FIFA's public schedule page snippets. Kickoff times are left null unless explicitly verified in this import pass."
    }
  ],
  matches: [
    groupMatch(1, "A", "MEX", "Mexico", "RSA", "South Africa", "2026-06-11", "Mexico City Stadium"),
    groupMatch(2, "A", "KOR", "Korea Republic", "CZE", "Czechia", "2026-06-11", "Estadio Guadalajara"),
    groupMatch(3, "B", "CAN", "Canada", "BIH", "Bosnia and Herzegovina", "2026-06-12", "Toronto Stadium"),
    groupMatch(4, "D", "USA", "USA", "PAR", "Paraguay", "2026-06-12", "Los Angeles Stadium"),
    groupMatch(5, "C", "HAI", "Haiti", "SCO", "Scotland", "2026-06-13", "Boston Stadium"),
    groupMatch(6, "D", "AUS", "Australia", "TUR", "Turkiye", "2026-06-13", "BC Place Vancouver"),
    groupMatch(7, "C", "BRA", "Brazil", "MAR", "Morocco", "2026-06-13", "New York New Jersey Stadium"),
    groupMatch(8, "B", "QAT", "Qatar", "SUI", "Switzerland", "2026-06-13", "San Francisco Bay Area Stadium"),
    groupMatch(9, "E", "CIV", "Cote d'Ivoire", "ECU", "Ecuador", "2026-06-14", "Philadelphia Stadium"),
    groupMatch(10, "E", "GER", "Germany", "CUW", "Curacao", "2026-06-14", "Houston Stadium"),
    groupMatch(11, "F", "NED", "Netherlands", "JPN", "Japan", "2026-06-14", "Dallas Stadium"),
    groupMatch(12, "F", "SWE", "Sweden", "TUN", "Tunisia", "2026-06-14", "Estadio Monterrey")
  ]
};

function groupMatch(
  matchNumber: number,
  group: string,
  homeCode: string,
  homeName: string,
  awayCode: string,
  awayName: string,
  localDate: string,
  venue: string
): WorldCupMatch {
  return {
    id: `wc2026-${matchNumber.toString().padStart(3, "0")}`,
    matchNumber,
    phase: "group",
    group,
    homeTeam: { code: homeCode, name: homeName },
    awayTeam: { code: awayCode, name: awayName },
    localDate,
    kickoffTimeLocal: null,
    venue,
    sourceId: fifaScheduleSourceId
  };
}
