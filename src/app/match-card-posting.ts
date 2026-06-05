import { createMatchCardMessage, type MatchCardMessage } from "../discord/components.js";
import type {
  PostedMatchCardSource,
  StoredPostedMatchCard
} from "../storage/database.js";
import type { WorldCupMatch } from "../worldcup/types.js";

export interface PostDueMatchCardsOptions {
  matches: WorldCupMatch[];
  channelId: string;
  date: string;
  postSource: PostedMatchCardSource;
  timeZone: string;
  now(): Date;
  listPostedMatchCards(): StoredPostedMatchCard[];
  sendMatchCard(matchId: string, message: MatchCardMessage): Promise<string>;
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

  for (const match of options.matches.filter((candidate) => candidate.localDate === options.date)) {
    if (alreadyPosted.has(match.id)) {
      skipped.push(match.id);
      continue;
    }

    const message = createMatchCardMessage(match, { timeZone: options.timeZone });
    const messageId = await options.sendMatchCard(match.id, message);

    options.recordPostedMatchCard({
      matchId: match.id,
      channelId: options.channelId,
      messageId,
      postedForDate: options.date,
      postedAt: options.now().toISOString(),
      postSource: options.postSource
    });
    alreadyPosted.add(match.id);
    posted.push(match.id);
  }

  return { posted, skipped };
}
