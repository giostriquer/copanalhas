import { formatLockedPredictionRevealBatch } from "../predictions/locked-reveal.js";
import type {
  StoredPostedMatchCard,
  StoredPrediction,
  StoredPredictionRevealPost
} from "../storage/database.js";
import { getPredictionWindow } from "../worldcup/cutoff.js";
import type { WorldCupMatch } from "../worldcup/types.js";

export interface PredictionRevealThreadMessage {
  parentMessageId: string;
  threadName: string;
  content: string;
}

export interface PredictionRevealSendResult {
  threadId: string;
  messageId: string;
}

export interface PostDuePredictionRevealsOptions {
  channelId: string;
  matches: readonly WorldCupMatch[];
  predictions: readonly StoredPrediction[];
  now(): Date;
  listPostedMatchCards(): StoredPostedMatchCard[];
  listPredictionRevealPosts(): StoredPredictionRevealPost[];
  sendPredictionReveal(message: PredictionRevealThreadMessage): Promise<PredictionRevealSendResult>;
  recordPredictionRevealPost(post: StoredPredictionRevealPost): void;
}

export interface PostedPredictionRevealBatch {
  matchIds: string[];
  threadId: string;
  messageId: string;
}

export interface PostDuePredictionRevealsResult {
  posted: PostedPredictionRevealBatch[];
  skipped: string[];
}

interface DueRevealMatch {
  match: WorldCupMatch;
  postedCard: StoredPostedMatchCard;
  closeAtUtc: string;
}

export async function postDuePredictionReveals(
  options: PostDuePredictionRevealsOptions
): Promise<PostDuePredictionRevealsResult> {
  const now = options.now();
  const nowMs = now.getTime();
  const revealedMatchIds = new Set(
    options
      .listPredictionRevealPosts()
      .filter((post) => post.channelId === options.channelId)
      .map((post) => post.matchId)
  );
  const postedCardsByMatchId = new Map(
    options
      .listPostedMatchCards()
      .filter((card) => card.channelId === options.channelId)
      .map((card) => [card.matchId, card])
  );
  const dueMatches: DueRevealMatch[] = [];
  const skipped: string[] = [];

  for (const match of options.matches) {
    if (revealedMatchIds.has(match.id)) {
      skipped.push(match.id);
      continue;
    }

    const window = getPredictionWindow(match);

    if (!window.closesAtUtc || nowMs < Date.parse(window.closesAtUtc)) {
      continue;
    }

    const postedCard = postedCardsByMatchId.get(match.id);

    if (!postedCard) {
      continue;
    }

    dueMatches.push({ match, postedCard, closeAtUtc: window.closesAtUtc });
  }

  const posted: PostedPredictionRevealBatch[] = [];

  for (const group of groupDueMatches(dueMatches)) {
    const sendResult = await options.sendPredictionReveal({
      parentMessageId: group.parentMessageId,
      threadName: `Palpites ${group.postedForDate}`,
      content: formatLockedPredictionRevealBatch({
        matches: group.matches.map((entry) => entry.match),
        predictions: options.predictions
      })
    });
    const matchIds = group.matches.map((entry) => entry.match.id);

    for (const entry of group.matches) {
      options.recordPredictionRevealPost({
        matchId: entry.match.id,
        channelId: options.channelId,
        threadId: sendResult.threadId,
        messageId: sendResult.messageId,
        revealedAt: now.toISOString(),
        closeAtUtc: entry.closeAtUtc,
        resultRevealedAt: null
      });
    }

    posted.push({
      matchIds,
      threadId: sendResult.threadId,
      messageId: sendResult.messageId
    });
  }

  return { posted, skipped };
}

function groupDueMatches(matches: DueRevealMatch[]): Array<{
  parentMessageId: string;
  postedForDate: string;
  matches: DueRevealMatch[];
}> {
  const groups = new Map<
    string,
    { parentMessageId: string; postedForDate: string; matches: DueRevealMatch[] }
  >();

  for (const entry of matches.toSorted((left, right) => left.match.matchNumber - right.match.matchNumber)) {
    const key = [
      entry.postedCard.postedForDate,
      entry.postedCard.messageId,
      entry.closeAtUtc
    ].join("|");
    const group =
      groups.get(key) ??
      {
        parentMessageId: entry.postedCard.messageId,
        postedForDate: entry.postedCard.postedForDate,
        matches: []
      };

    group.matches.push(entry);
    groups.set(key, group);
  }

  return [...groups.values()];
}
