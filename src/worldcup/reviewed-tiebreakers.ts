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
  }
];
