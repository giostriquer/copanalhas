import type { WorldCupMatch, WorldCupTeam } from "./types.js";

export function hasResolvedPredictionParticipants(match: WorldCupMatch): boolean {
  if (match.phase === "group") {
    return true;
  }

  return !isUnresolvedParticipant(match.homeTeam) && !isUnresolvedParticipant(match.awayTeam);
}

function isUnresolvedParticipant(team: WorldCupTeam): boolean {
  return /^[123][A-L]+$/u.test(team.code) || /^[WL]\d+$/u.test(team.code);
}
