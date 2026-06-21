export type BracketPhase = "provisional" | "final" | "blocked";

export type BracketRoundKey =
  | "round_of_32"
  | "round_of_16"
  | "quarter_finals"
  | "semi_finals"
  | "third_place"
  | "final";

export type BracketMatchState = "provisional" | "scheduled" | "final" | "blocked";

export interface BracketState {
  phase: BracketPhase;
  generatedAtLabel?: string;
  rounds: BracketRound[];
  notes: string[];
}

export interface BracketRound {
  key: BracketRoundKey;
  label: string;
  matches: BracketMatch[];
}

export interface BracketMatch {
  id: string;
  label: string;
  state: BracketMatchState;
  home: BracketEntrant;
  away: BracketEntrant;
  kickoffLabel?: string;
  scoreLabel?: string;
}

export interface BracketEntrant {
  label: string;
  teamCode?: string;
  teamName?: string;
  sourceSlot?: string;
  warning?: "tie-order-provisional";
}
