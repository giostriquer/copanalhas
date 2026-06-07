import { createMatchDayMessage, type MatchCardMessage } from "../discord/components.js";
import type {
  PostedMatchCardSource,
  StoredPostedMatchCard
} from "../storage/database.js";
import { isMatchOnMatchday } from "../worldcup/matchday.js";
import type { WorldCupMatch } from "../worldcup/types.js";

export interface PostDueMatchCardsOptions {
  matches: WorldCupMatch[];
  channelId: string;
  date: string;
  postSource: PostedMatchCardSource;
  timeZone: string;
  matchdayRolloverTime: string;
  now(): Date;
  listPostedMatchCards(): StoredPostedMatchCard[];
  sendMatchCard(message: MatchCardMessage): Promise<string>;
  recordPostedMatchCard(card: StoredPostedMatchCard): void;
}

export interface PostDueMatchCardsResult {
  posted: string[];
  skipped: string[];
}

export async function postDueMatchCards(
  options: PostDueMatchCardsOptions
): Promise<PostDueMatchCardsResult> {
  const alreadyPosted = new Set(
    options
      .listPostedMatchCards()
      .filter((card) => card.channelId === options.channelId && card.postedForDate === options.date)
      .map((card) => card.matchId)
  );
  const posted: string[] = [];
  const skipped: string[] = [];
  const dueMatches: WorldCupMatch[] = [];

  for (const match of options.matches.filter((candidate) =>
    isMatchOnMatchday(candidate, options.date, options.timeZone, options.matchdayRolloverTime)
  )) {
    if (alreadyPosted.has(match.id)) {
      skipped.push(match.id);
      continue;
    }

    dueMatches.push(match);
  }

  if (dueMatches.length === 0) {
    return { posted, skipped };
  }

  const message = createMatchDayMessage(dueMatches, {
    date: options.date,
    timeZone: options.timeZone
  });
  const messageId = await options.sendMatchCard(message);
  const postedAt = options.now().toISOString();

  for (const match of dueMatches) {
    options.recordPostedMatchCard({
      matchId: match.id,
      channelId: options.channelId,
      messageId,
      postedForDate: options.date,
      postedAt,
      postSource: options.postSource
    });
    alreadyPosted.add(match.id);
    posted.push(match.id);
  }

  return { posted, skipped };
}
