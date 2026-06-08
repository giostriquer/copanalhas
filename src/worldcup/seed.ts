import type { TournamentSeed, WorldCupExternalIds, WorldCupMatch } from "./types.js";

const fifaScheduleSourceId = "fifa-match-schedule-2026-03-31";

export const WORLD_CUP_2026_SEED: TournamentSeed = {
  schemaVersion: 1,
  tournamentId: "fifa-world-cup-2026",
  importedAt: "2026-06-08",
  sources: [
    {
      id: fifaScheduleSourceId,
      title: "FIFA World Cup 2026 match schedule",
      url: "https://digitalhub.fifa.com/asset/4b5d4417-3343-4732-9cdf-14b6662af407/FWC26-Match-Schedule_English.pdf",
      accessedAt: "2026-06-05",
      notes:
        "Official FIFA match schedule PDF for fixture order, groups, host cities, venues, dates, and kick-off times. Times are recorded as venue-local time plus UTC ISO timestamps."
    },
    {
      id: "kickofftimes-jsonld-2026-06-05",
      title: "Kickoff Times JSON-LD extraction helper",
      url: "https://kickofftimes.tv/",
      accessedAt: "2026-06-05",
      notes:
        "Fan-made static JSON-LD payload used only as an extraction aid for venue-local ISO offsets. Fixture source of truth remains the FIFA schedule."
    },
    {
      id: "football-data-wc-2026-06-08",
      title: "football-data.org FIFA World Cup 2026 matches",
      url: "https://api.football-data.org/v4/competitions/WC/matches?season=2026",
      accessedAt: "2026-06-08",
      notes:
        "Provider match IDs for autonomous result sync. Fixture source of truth remains the FIFA schedule."
    }
  ],
  matches: [
    groupMatch(1, "A", "MEX", "Mexico", "RSA", "South Africa", "2026-06-11", "13:00", "2026-06-11T19:00:00.000Z", "Mexico City Stadium", { footballData: 537327 }),
    groupMatch(2, "A", "KOR", "Korea Republic", "CZE", "Czechia", "2026-06-11", "20:00", "2026-06-12T02:00:00.000Z", "Estadio Guadalajara", { footballData: 537328 }),
    groupMatch(3, "B", "CAN", "Canada", "BIH", "Bosnia and Herzegovina", "2026-06-12", "15:00", "2026-06-12T19:00:00.000Z", "Toronto Stadium", { footballData: 537333 }),
    groupMatch(4, "D", "USA", "USA", "PAR", "Paraguay", "2026-06-12", "18:00", "2026-06-13T01:00:00.000Z", "Los Angeles Stadium", { footballData: 537345 }),
    groupMatch(5, "B", "QAT", "Qatar", "SUI", "Switzerland", "2026-06-13", "12:00", "2026-06-13T19:00:00.000Z", "San Francisco Bay Area Stadium", { footballData: 537334 }),
    groupMatch(6, "C", "BRA", "Brazil", "MAR", "Morocco", "2026-06-13", "18:00", "2026-06-13T22:00:00.000Z", "New York New Jersey Stadium", { footballData: 537339 }),
    groupMatch(7, "C", "HAI", "Haiti", "SCO", "Scotland", "2026-06-13", "21:00", "2026-06-14T01:00:00.000Z", "Boston Stadium", { footballData: 537340 }),
    groupMatch(8, "D", "AUS", "Australia", "TUR", "Turkiye", "2026-06-13", "21:00", "2026-06-14T04:00:00.000Z", "BC Place Vancouver", { footballData: 537346 }),
    groupMatch(9, "E", "GER", "Germany", "CUW", "Curacao", "2026-06-14", "12:00", "2026-06-14T17:00:00.000Z", "Houston Stadium", { footballData: 537351 }),
    groupMatch(10, "F", "NED", "Netherlands", "JPN", "Japan", "2026-06-14", "15:00", "2026-06-14T20:00:00.000Z", "Dallas Stadium", { footballData: 537357 }),
    groupMatch(11, "E", "CIV", "Cote d'Ivoire", "ECU", "Ecuador", "2026-06-14", "19:00", "2026-06-14T23:00:00.000Z", "Philadelphia Stadium", { footballData: 537352 }),
    groupMatch(12, "F", "SWE", "Sweden", "TUN", "Tunisia", "2026-06-14", "20:00", "2026-06-15T02:00:00.000Z", "Estadio Monterrey", { footballData: 537358 }),
    groupMatch(13, "H", "ESP", "Spain", "CPV", "Cape Verde", "2026-06-15", "12:00", "2026-06-15T16:00:00.000Z", "Atlanta Stadium", { footballData: 537369 }),
    groupMatch(14, "G", "BEL", "Belgium", "EGY", "Egypt", "2026-06-15", "12:00", "2026-06-15T19:00:00.000Z", "Seattle Stadium", { footballData: 537363 }),
    groupMatch(15, "H", "KSA", "Saudi Arabia", "URU", "Uruguay", "2026-06-15", "18:00", "2026-06-15T22:00:00.000Z", "Miami Stadium", { footballData: 537370 }),
    groupMatch(16, "G", "IRN", "Iran", "NZL", "New Zealand", "2026-06-15", "18:00", "2026-06-16T01:00:00.000Z", "Los Angeles Stadium", { footballData: 537364 }),
    groupMatch(17, "I", "FRA", "France", "SEN", "Senegal", "2026-06-16", "15:00", "2026-06-16T19:00:00.000Z", "New York New Jersey Stadium", { footballData: 537391 }),
    groupMatch(18, "I", "IRQ", "Iraq", "NOR", "Norway", "2026-06-16", "18:00", "2026-06-16T22:00:00.000Z", "Boston Stadium", { footballData: 537392 }),
    groupMatch(19, "J", "ARG", "Argentina", "ALG", "Algeria", "2026-06-16", "20:00", "2026-06-17T01:00:00.000Z", "Kansas City Stadium", { footballData: 537397 }),
    groupMatch(20, "J", "AUT", "Austria", "JOR", "Jordan", "2026-06-16", "21:00", "2026-06-17T04:00:00.000Z", "San Francisco Bay Area Stadium", { footballData: 537398 }),
    groupMatch(21, "K", "POR", "Portugal", "COD", "DR Congo", "2026-06-17", "12:00", "2026-06-17T17:00:00.000Z", "Houston Stadium", { footballData: 537403 }),
    groupMatch(22, "L", "ENG", "England", "CRO", "Croatia", "2026-06-17", "15:00", "2026-06-17T20:00:00.000Z", "Dallas Stadium", { footballData: 537409 }),
    groupMatch(23, "L", "GHA", "Ghana", "PAN", "Panama", "2026-06-17", "19:00", "2026-06-17T23:00:00.000Z", "Toronto Stadium", { footballData: 537410 }),
    groupMatch(24, "K", "UZB", "Uzbekistan", "COL", "Colombia", "2026-06-17", "20:00", "2026-06-18T02:00:00.000Z", "Mexico City Stadium", { footballData: 537404 }),
    groupMatch(25, "A", "CZE", "Czechia", "RSA", "South Africa", "2026-06-18", "12:00", "2026-06-18T16:00:00.000Z", "Atlanta Stadium", { footballData: 537329 }),
    groupMatch(26, "B", "SUI", "Switzerland", "BIH", "Bosnia and Herzegovina", "2026-06-18", "12:00", "2026-06-18T19:00:00.000Z", "Los Angeles Stadium", { footballData: 537335 }),
    groupMatch(27, "B", "CAN", "Canada", "QAT", "Qatar", "2026-06-18", "15:00", "2026-06-18T22:00:00.000Z", "BC Place Vancouver", { footballData: 537336 }),
    groupMatch(28, "A", "MEX", "Mexico", "KOR", "Korea Republic", "2026-06-18", "19:00", "2026-06-19T01:00:00.000Z", "Estadio Guadalajara", { footballData: 537330 }),
    groupMatch(29, "D", "USA", "USA", "AUS", "Australia", "2026-06-19", "12:00", "2026-06-19T19:00:00.000Z", "Seattle Stadium", { footballData: 537348 }),
    groupMatch(30, "C", "SCO", "Scotland", "MAR", "Morocco", "2026-06-19", "18:00", "2026-06-19T22:00:00.000Z", "Boston Stadium", { footballData: 537342 }),
    groupMatch(31, "C", "BRA", "Brazil", "HAI", "Haiti", "2026-06-19", "20:30", "2026-06-20T00:30:00.000Z", "Philadelphia Stadium", { footballData: 537341 }),
    groupMatch(32, "D", "TUR", "Turkiye", "PAR", "Paraguay", "2026-06-19", "20:00", "2026-06-20T03:00:00.000Z", "San Francisco Bay Area Stadium", { footballData: 537347 }),
    groupMatch(33, "F", "NED", "Netherlands", "SWE", "Sweden", "2026-06-20", "12:00", "2026-06-20T17:00:00.000Z", "Houston Stadium", { footballData: 537359 }),
    groupMatch(34, "E", "GER", "Germany", "CIV", "Cote d'Ivoire", "2026-06-20", "16:00", "2026-06-20T20:00:00.000Z", "Toronto Stadium", { footballData: 537353 }),
    groupMatch(35, "E", "ECU", "Ecuador", "CUW", "Curacao", "2026-06-20", "19:00", "2026-06-21T00:00:00.000Z", "Kansas City Stadium", { footballData: 537354 }),
    groupMatch(36, "F", "TUN", "Tunisia", "JPN", "Japan", "2026-06-20", "22:00", "2026-06-21T04:00:00.000Z", "Estadio Monterrey", { footballData: 537360 }),
    groupMatch(37, "H", "ESP", "Spain", "KSA", "Saudi Arabia", "2026-06-21", "12:00", "2026-06-21T16:00:00.000Z", "Atlanta Stadium", { footballData: 537371 }),
    groupMatch(38, "G", "BEL", "Belgium", "IRN", "Iran", "2026-06-21", "12:00", "2026-06-21T19:00:00.000Z", "Los Angeles Stadium", { footballData: 537365 }),
    groupMatch(39, "H", "URU", "Uruguay", "CPV", "Cape Verde", "2026-06-21", "18:00", "2026-06-21T22:00:00.000Z", "Miami Stadium", { footballData: 537372 }),
    groupMatch(40, "G", "NZL", "New Zealand", "EGY", "Egypt", "2026-06-21", "18:00", "2026-06-22T01:00:00.000Z", "BC Place Vancouver", { footballData: 537366 }),
    groupMatch(41, "J", "ARG", "Argentina", "AUT", "Austria", "2026-06-22", "12:00", "2026-06-22T17:00:00.000Z", "Dallas Stadium", { footballData: 537399 }),
    groupMatch(42, "I", "FRA", "France", "IRQ", "Iraq", "2026-06-22", "17:00", "2026-06-22T21:00:00.000Z", "Philadelphia Stadium", { footballData: 537393 }),
    groupMatch(43, "I", "NOR", "Norway", "SEN", "Senegal", "2026-06-22", "20:00", "2026-06-23T00:00:00.000Z", "New York New Jersey Stadium", { footballData: 537394 }),
    groupMatch(44, "J", "JOR", "Jordan", "ALG", "Algeria", "2026-06-22", "20:00", "2026-06-23T03:00:00.000Z", "San Francisco Bay Area Stadium", { footballData: 537400 }),
    groupMatch(45, "K", "POR", "Portugal", "UZB", "Uzbekistan", "2026-06-23", "12:00", "2026-06-23T17:00:00.000Z", "Houston Stadium", { footballData: 537405 }),
    groupMatch(46, "L", "ENG", "England", "GHA", "Ghana", "2026-06-23", "16:00", "2026-06-23T20:00:00.000Z", "Boston Stadium", { footballData: 537411 }),
    groupMatch(47, "L", "PAN", "Panama", "CRO", "Croatia", "2026-06-23", "19:00", "2026-06-23T23:00:00.000Z", "Toronto Stadium", { footballData: 537412 }),
    groupMatch(48, "K", "COL", "Colombia", "COD", "DR Congo", "2026-06-23", "20:00", "2026-06-24T02:00:00.000Z", "Estadio Guadalajara", { footballData: 537406 }),
    groupMatch(49, "B", "SUI", "Switzerland", "CAN", "Canada", "2026-06-24", "12:00", "2026-06-24T19:00:00.000Z", "BC Place Vancouver", { footballData: 537337 }),
    groupMatch(50, "B", "BIH", "Bosnia and Herzegovina", "QAT", "Qatar", "2026-06-24", "12:00", "2026-06-24T19:00:00.000Z", "Seattle Stadium", { footballData: 537338 }),
    groupMatch(51, "C", "SCO", "Scotland", "BRA", "Brazil", "2026-06-24", "18:00", "2026-06-24T22:00:00.000Z", "Miami Stadium", { footballData: 537343 }),
    groupMatch(52, "C", "MAR", "Morocco", "HAI", "Haiti", "2026-06-24", "18:00", "2026-06-24T22:00:00.000Z", "Atlanta Stadium", { footballData: 537344 }),
    groupMatch(53, "A", "CZE", "Czechia", "MEX", "Mexico", "2026-06-24", "19:00", "2026-06-25T01:00:00.000Z", "Mexico City Stadium", { footballData: 537331 }),
    groupMatch(54, "A", "RSA", "South Africa", "KOR", "Korea Republic", "2026-06-24", "19:00", "2026-06-25T01:00:00.000Z", "Estadio Monterrey", { footballData: 537332 }),
    groupMatch(55, "E", "CUW", "Curacao", "CIV", "Cote d'Ivoire", "2026-06-25", "16:00", "2026-06-25T20:00:00.000Z", "Philadelphia Stadium", { footballData: 537356 }),
    groupMatch(56, "E", "ECU", "Ecuador", "GER", "Germany", "2026-06-25", "16:00", "2026-06-25T20:00:00.000Z", "New York New Jersey Stadium", { footballData: 537355 }),
    groupMatch(57, "F", "JPN", "Japan", "SWE", "Sweden", "2026-06-25", "18:00", "2026-06-25T23:00:00.000Z", "Dallas Stadium", { footballData: 537362 }),
    groupMatch(58, "F", "TUN", "Tunisia", "NED", "Netherlands", "2026-06-25", "18:00", "2026-06-25T23:00:00.000Z", "Kansas City Stadium", { footballData: 537361 }),
    groupMatch(59, "D", "TUR", "Turkiye", "USA", "USA", "2026-06-25", "19:00", "2026-06-26T02:00:00.000Z", "Los Angeles Stadium", { footballData: 537349 }),
    groupMatch(60, "D", "PAR", "Paraguay", "AUS", "Australia", "2026-06-25", "19:00", "2026-06-26T02:00:00.000Z", "San Francisco Bay Area Stadium", { footballData: 537350 }),
    groupMatch(61, "I", "NOR", "Norway", "FRA", "France", "2026-06-26", "15:00", "2026-06-26T19:00:00.000Z", "Boston Stadium", { footballData: 537395 }),
    groupMatch(62, "I", "SEN", "Senegal", "IRQ", "Iraq", "2026-06-26", "15:00", "2026-06-26T19:00:00.000Z", "Toronto Stadium", { footballData: 537396 }),
    groupMatch(63, "H", "CPV", "Cape Verde", "KSA", "Saudi Arabia", "2026-06-26", "19:00", "2026-06-27T00:00:00.000Z", "Houston Stadium", { footballData: 537374 }),
    groupMatch(64, "H", "URU", "Uruguay", "ESP", "Spain", "2026-06-26", "18:00", "2026-06-27T00:00:00.000Z", "Estadio Guadalajara", { footballData: 537373 }),
    groupMatch(65, "G", "EGY", "Egypt", "IRN", "Iran", "2026-06-26", "20:00", "2026-06-27T03:00:00.000Z", "Seattle Stadium", { footballData: 537368 }),
    groupMatch(66, "G", "NZL", "New Zealand", "BEL", "Belgium", "2026-06-26", "20:00", "2026-06-27T03:00:00.000Z", "BC Place Vancouver", { footballData: 537367 }),
    groupMatch(67, "L", "PAN", "Panama", "ENG", "England", "2026-06-27", "17:00", "2026-06-27T21:00:00.000Z", "New York New Jersey Stadium", { footballData: 537413 }),
    groupMatch(68, "L", "CRO", "Croatia", "GHA", "Ghana", "2026-06-27", "17:00", "2026-06-27T21:00:00.000Z", "Philadelphia Stadium", { footballData: 537414 }),
    groupMatch(69, "K", "COL", "Colombia", "POR", "Portugal", "2026-06-27", "19:30", "2026-06-27T23:30:00.000Z", "Miami Stadium", { footballData: 537407 }),
    groupMatch(70, "K", "COD", "DR Congo", "UZB", "Uzbekistan", "2026-06-27", "19:30", "2026-06-27T23:30:00.000Z", "Atlanta Stadium", { footballData: 537408 }),
    groupMatch(71, "J", "ALG", "Algeria", "AUT", "Austria", "2026-06-27", "21:00", "2026-06-28T02:00:00.000Z", "Kansas City Stadium", { footballData: 537402 }),
    groupMatch(72, "J", "JOR", "Jordan", "ARG", "Argentina", "2026-06-27", "21:00", "2026-06-28T02:00:00.000Z", "Dallas Stadium", { footballData: 537401 })
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
  kickoffTimeLocal: string,
  kickoffAtUtc: string,
  venue: string,
  externalIds: WorldCupExternalIds = {}
): WorldCupMatch {
  return {
    id: `wc2026-${matchNumber.toString().padStart(3, "0")}`,
    matchNumber,
    phase: "group",
    group,
    homeTeam: { code: homeCode, name: homeName },
    awayTeam: { code: awayCode, name: awayName },
    localDate,
    kickoffTimeLocal,
    kickoffAtUtc,
    venue,
    sourceId: fifaScheduleSourceId,
    externalIds
  };
}
