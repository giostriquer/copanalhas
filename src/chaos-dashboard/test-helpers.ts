import type { ChaosDashboardModel } from "./types.js";

export function sampleChaosDashboardModel(
  overrides: Partial<ChaosDashboardModel> = {}
): ChaosDashboardModel {
  return {
    title: "Copanalhas Recap",
    generatedAtLabel: "2026-06-24 12:30 GMT-3",
    period: {
      key: "group-week-1",
      label: "Fase de grupos - semana 1"
    },
    week: {
      start: "2026-06-22",
      end: "2026-06-28",
      label: "2026-06-22..2026-06-28"
    },
    totals: {
      scoredMatches: 12,
      predictions: 144,
      finishedPredictions: 120
    },
    leaderboardTop: [
      {
        userId: "user-a",
        displayName: "Guibexa",
        rank: 1,
        points: 23,
        soloCount: 1,
        exactCount: 4,
        outcomeCount: 3,
        closestCount: 0,
        matchesScored: 12
      }
    ],
    leaderOfWeek: {
      userId: "user-a",
      displayName: "Guibexa",
      points: 23,
      soloCount: 1,
      exactCount: 4,
      outcomeCount: 3,
      closestCount: 0,
      avatarDataUri: "data:image/png;base64,leader-avatar"
    },
    weeklyMovement: {
      status: "ready",
      climbers: [
        {
          userId: "user-a",
          displayName: "Guibexa",
          rank: 1,
          previousRank: 4,
          movement: 3,
          points: 23
        }
      ],
      fallers: [
        {
          userId: "user-b",
          displayName: "SEVERAO DO HEXA",
          rank: 7,
          previousRank: 2,
          movement: -5,
          points: 11
        }
      ],
      newcomers: []
    },
    peopleAwards: [
      {
        key: "profeta-isolado",
        title: "Profeta isolado",
        subject: "Guibexa",
        value: "1 solos",
        subtitle: "Cravou sozinho e deixou a mesa olhando torto."
      }
    ],
    matchAwards: [
      {
        key: "consenso-burro",
        title: "Consenso burro",
        matchLabel: "#2 Alemanha x Escocia (0-1)",
        value: "2 no consenso errado",
        subtitle: "A democracia produziu uma derrota coletiva."
      }
    ],
    ...overrides
  };
}
