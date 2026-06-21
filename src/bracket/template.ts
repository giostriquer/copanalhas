import type { BracketRoundKey } from "./types.js";

export type RoundOf32WinnerSlot = "1A" | "1B" | "1D" | "1E" | "1G" | "1I" | "1K" | "1L";

export interface RoundOf32Template {
  matchNumber: number;
  homeSlot: string;
  awaySlot?: string;
  thirdPlaceWinnerSlot?: RoundOf32WinnerSlot;
}

export interface VisualSkeletonRoundTemplate {
  key: BracketRoundKey;
  label: string;
  matchCount: number;
  sourcePrefix: string;
}

export const ROUND_OF_32_TEMPLATES: readonly RoundOf32Template[] = [
  { matchNumber: 73, homeSlot: "2A", awaySlot: "2B" },
  { matchNumber: 74, homeSlot: "1E", thirdPlaceWinnerSlot: "1E" },
  { matchNumber: 75, homeSlot: "1F", awaySlot: "2C" },
  { matchNumber: 76, homeSlot: "1C", awaySlot: "2F" },
  { matchNumber: 77, homeSlot: "1I", thirdPlaceWinnerSlot: "1I" },
  { matchNumber: 78, homeSlot: "2E", awaySlot: "2I" },
  { matchNumber: 79, homeSlot: "1A", thirdPlaceWinnerSlot: "1A" },
  { matchNumber: 80, homeSlot: "1L", thirdPlaceWinnerSlot: "1L" },
  { matchNumber: 81, homeSlot: "1D", thirdPlaceWinnerSlot: "1D" },
  { matchNumber: 82, homeSlot: "1G", thirdPlaceWinnerSlot: "1G" },
  { matchNumber: 83, homeSlot: "2K", awaySlot: "2L" },
  { matchNumber: 84, homeSlot: "1H", awaySlot: "2J" },
  { matchNumber: 85, homeSlot: "1B", thirdPlaceWinnerSlot: "1B" },
  { matchNumber: 86, homeSlot: "1J", awaySlot: "2H" },
  { matchNumber: 87, homeSlot: "1K", thirdPlaceWinnerSlot: "1K" },
  { matchNumber: 88, homeSlot: "2D", awaySlot: "2G" }
];

export const VISUAL_SKELETON_ROUNDS: readonly VisualSkeletonRoundTemplate[] = [
  { key: "round_of_16", label: "Round of 16", matchCount: 8, sourcePrefix: "W-32" },
  { key: "quarter_finals", label: "Quarter-finals", matchCount: 4, sourcePrefix: "W-16" },
  { key: "semi_finals", label: "Semi-finals", matchCount: 2, sourcePrefix: "W-QF" },
  { key: "third_place", label: "Third-place play-off", matchCount: 1, sourcePrefix: "L-SF" },
  { key: "final", label: "Final", matchCount: 1, sourcePrefix: "W-SF" }
];
