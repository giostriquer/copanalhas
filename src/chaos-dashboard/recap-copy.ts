import type { ChaosPeopleAward } from "./types.js";

export interface ChaosRecapCopyArtifact {
  version: 1;
  periodKey: string;
  cards: ChaosRecapCopyCard[];
}

export interface ChaosRecapCopyCard {
  key: string;
  title: string;
  subtitle: string;
}

export interface ChaosRecapCopyInput {
  periodKey: string;
  periodLabel: string;
  awards: readonly ChaosPeopleAward[];
}

export interface ChaosRecapCopyResult {
  state: "applied" | "fallback";
  awards: ChaosPeopleAward[];
  appliedCount: number;
  error?: string;
}

export type GenerateChaosRecapCopy = (
  input: ChaosRecapCopyInput
) => Promise<ChaosRecapCopyArtifact | null>;

const maxCards = 16;
const maxTitleLength = 34;
const maxSubtitleLength = 104;

export function applyChaosRecapCopyArtifact(
  awards: readonly ChaosPeopleAward[],
  artifact: unknown,
  periodKey: string
): ChaosRecapCopyResult {
  try {
    const parsed = parseArtifact(artifact, awards, periodKey);
    const copyByKey = new Map(parsed.cards.map((card) => [card.key, card]));
    let appliedCount = 0;
    const nextAwards = awards.map((award) => {
      const copy = copyByKey.get(award.key);

      if (!copy) {
        return { ...award };
      }

      appliedCount += 1;

      return {
        ...award,
        title: copy.title,
        subtitle: copy.subtitle
      };
    });

    if (appliedCount === 0) {
      return fallback(awards, "artifact did not contain matching card keys");
    }

    return {
      state: "applied",
      awards: nextAwards,
      appliedCount
    };
  } catch (error) {
    return fallback(awards, errorMessage(error));
  }
}

function parseArtifact(
  artifact: unknown,
  awards: readonly ChaosPeopleAward[],
  periodKey: string
): ChaosRecapCopyArtifact {
  if (!isRecord(artifact)) {
    throw new Error("artifact must be an object");
  }

  if (artifact.version !== 1) {
    throw new Error("artifact version must be 1");
  }

  if (artifact.periodKey !== periodKey) {
    throw new Error(`artifact periodKey must match ${periodKey}`);
  }

  if (!Array.isArray(artifact.cards) || artifact.cards.length === 0) {
    throw new Error("artifact cards must be a non-empty array");
  }

  if (artifact.cards.length > maxCards) {
    throw new Error(`artifact cards must contain at most ${maxCards} cards`);
  }

  const knownKeys = new Set(awards.map((award) => award.key));
  const seenKeys = new Set<string>();

  return {
    version: 1,
    periodKey,
    cards: artifact.cards.map((card) => parseCard(card, knownKeys, seenKeys))
  };
}

function parseCard(
  card: unknown,
  knownKeys: ReadonlySet<string>,
  seenKeys: Set<string>
): ChaosRecapCopyCard {
  if (!isRecord(card)) {
    throw new Error("copy card must be an object");
  }

  if (typeof card.key !== "string" || !knownKeys.has(card.key)) {
    throw new Error("copy card key must match a deterministic award");
  }

  if (seenKeys.has(card.key)) {
    throw new Error(`copy card key ${card.key} is duplicated`);
  }

  seenKeys.add(card.key);

  return {
    key: card.key,
    title: safeCopyText(card.title, "title", maxTitleLength),
    subtitle: safeCopyText(card.subtitle, "subtitle", maxSubtitleLength)
  };
}

function safeCopyText(value: unknown, fieldName: string, maxLength: number): string {
  if (typeof value !== "string") {
    throw new Error(`copy card ${fieldName} must be a string`);
  }

  const normalized = value.replace(/\s+/gu, " ").trim();

  if (normalized.length === 0) {
    throw new Error(`copy card ${fieldName} must not be empty`);
  }

  if (normalized.length > maxLength) {
    throw new Error(`copy card ${fieldName} must be ${maxLength} characters or fewer`);
  }

  if (/[\u0000-\u001f\u007f]/u.test(value)) {
    throw new Error(`copy card ${fieldName} must not contain control characters`);
  }

  if (containsDiscordMention(normalized)) {
    throw new Error(`copy card ${fieldName} must not contain Discord mention text`);
  }

  return normalized;
}

function containsDiscordMention(value: string): boolean {
  return /(?:@everyone|@here|<@|<#|<@&)/iu.test(value);
}

function fallback(awards: readonly ChaosPeopleAward[], error: string): ChaosRecapCopyResult {
  return {
    state: "fallback",
    awards: awards.map((award) => ({ ...award })),
    appliedCount: 0,
    error
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
