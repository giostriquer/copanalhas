import type { FifaReviewedTiebreakerOrder } from "./fifa-qualification.js";

export const FIFA_2026_REVIEWED_TIEBREAKER_ORDERS: readonly FifaReviewedTiebreakerOrder[] = [
  {
    group: "C",
    orderedTeamCodes: ["MAR", "BRA"],
    appliesTo: [
      {
        teamCode: "MAR",
        played: 1,
        points: 1,
        goalDifference: 0,
        goalsFor: 1,
        goalsAgainst: 1
      },
      {
        teamCode: "BRA",
        played: 1,
        points: 1,
        goalDifference: 0,
        goalsFor: 1,
        goalsAgainst: 1
      }
    ],
    reason: "team-conduct",
    source: "Operator-verified official FIFA standings after Brazil 1-1 Morocco on 2026-06-13.",
    reviewedAt: "2026-06-19"
  },
  {
    group: "G",
    orderedTeamCodes: ["NZL", "IRN"],
    appliesTo: [
      {
        teamCode: "NZL",
        played: 1,
        points: 1,
        goalDifference: 0,
        goalsFor: 2,
        goalsAgainst: 2
      },
      {
        teamCode: "IRN",
        played: 1,
        points: 1,
        goalDifference: 0,
        goalsFor: 2,
        goalsAgainst: 2
      }
    ],
    reason: "official-standings",
    source:
      "Operator-provided FIFA live bracket reference after Iran 2-2 New Zealand on 2026-06-20.",
    reviewedAt: "2026-06-20"
  },
  {
    group: "G",
    orderedTeamCodes: ["BEL", "EGY"],
    appliesTo: [
      {
        teamCode: "BEL",
        played: 1,
        points: 1,
        goalDifference: 0,
        goalsFor: 1,
        goalsAgainst: 1
      },
      {
        teamCode: "EGY",
        played: 1,
        points: 1,
        goalDifference: 0,
        goalsFor: 1,
        goalsAgainst: 1
      }
    ],
    reason: "official-standings",
    source: "Operator-provided FIFA live bracket reference after Belgium 1-1 Egypt on 2026-06-20.",
    reviewedAt: "2026-06-20"
  },
  {
    group: "H",
    orderedTeamCodes: ["URU", "KSA"],
    appliesTo: [
      {
        teamCode: "URU",
        played: 1,
        points: 1,
        goalDifference: 0,
        goalsFor: 1,
        goalsAgainst: 1
      },
      {
        teamCode: "KSA",
        played: 1,
        points: 1,
        goalDifference: 0,
        goalsFor: 1,
        goalsAgainst: 1
      }
    ],
    reason: "official-standings",
    source:
      "Operator-provided FIFA live bracket reference after Saudi Arabia 1-1 Uruguay on 2026-06-20.",
    reviewedAt: "2026-06-20"
  },
  {
    group: "H",
    orderedTeamCodes: ["ESP", "CPV"],
    appliesTo: [
      {
        teamCode: "ESP",
        played: 1,
        points: 1,
        goalDifference: 0,
        goalsFor: 0,
        goalsAgainst: 0
      },
      {
        teamCode: "CPV",
        played: 1,
        points: 1,
        goalDifference: 0,
        goalsFor: 0,
        goalsAgainst: 0
      }
    ],
    reason: "official-standings",
    source:
      "Operator-provided FIFA live bracket reference after Spain 0-0 Cape Verde on 2026-06-20.",
    reviewedAt: "2026-06-20"
  }
];
