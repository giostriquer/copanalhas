import { formatPredictionResultRevealBatch } from "../predictions/locked-reveal.js";
import type {
  StoredPrediction,
  StoredPredictionRevealPost,
  StoredResult
} from "../storage/database.js";
import type { WorldCupMatch } from "../worldcup/types.js";

export interface PredictionResultThreadMessage {
  threadId: string;
  messageId: string;
  content: string;
}

export interface PostDuePredictionResultRevealsOptions {
  channelId: string;
  matches: readonly WorldCupMatch[];
  predictions: readonly StoredPrediction[];
  results: readonly StoredResult[];
  now(): Date;
  listPredictionRevealPosts(): StoredPredictionRevealPost[];
  editPredictionReveal(message: PredictionResultThreadMessage): Promise<void>;
  recordPredictionRevealPost(post: StoredPredictionRevealPost): void;
}

export interface EditedPredictionResultReveal {
  matchIds: string[];
  threadId: string;
  messageId: string;
}

export interface PostDuePredictionResultRevealsResult {
  edited: EditedPredictionResultReveal[];
  skipped: string[];
}

export async function postDuePredictionResultReveals(
  options: PostDuePredictionResultRevealsOptions
): Promise<PostDuePredictionResultRevealsResult> {
  const revealPosts = options
    .listPredictionRevealPosts()
    .filter((post) => post.channelId === options.channelId);
  const finalizedMatchIds = new Set(
    revealPosts.filter((post) => post.resultRevealedAt !== null).map((post) => post.matchId)
  );
  const pendingRevealPosts = revealPosts.filter((post) => post.resultRevealedAt === null);
  const matchesById = new Map(options.matches.map((match) => [match.id, match]));
  const resultsByMatchId = new Map(options.results.map((result) => [result.matchId, result]));
  const edited: EditedPredictionResultReveal[] = [];
  const skipped: string[] = [...finalizedMatchIds];
  const finalizedAt = options.now().toISOString();

  for (const group of groupRevealPosts(pendingRevealPosts)) {
    const matches = group.posts
      .map((post) => matchesById.get(post.matchId))
      .filter((match): match is WorldCupMatch => match !== undefined);
    const allResultsAvailable =
      matches.length === group.posts.length &&
      group.posts.every((post) => resultsByMatchId.has(post.matchId));

    if (!allResultsAvailable) {
      skipped.push(...group.posts.map((post) => post.matchId));
      continue;
    }

    await options.editPredictionReveal({
      threadId: group.threadId,
      messageId: group.messageId,
      content: formatPredictionResultRevealBatch({
        matches,
        predictions: options.predictions,
        results: group.posts
          .map((post) => resultsByMatchId.get(post.matchId))
          .filter((result): result is StoredResult => result !== undefined)
      })
    });

    for (const post of group.posts) {
      options.recordPredictionRevealPost({
        ...post,
        resultRevealedAt: finalizedAt
      });
    }

    edited.push({
      matchIds: group.posts.map((post) => post.matchId),
      threadId: group.threadId,
      messageId: group.messageId
    });
  }

  return { edited, skipped };
}

function groupRevealPosts(posts: StoredPredictionRevealPost[]): Array<{
  threadId: string;
  messageId: string;
  posts: StoredPredictionRevealPost[];
}> {
  const groups = new Map<
    string,
    { threadId: string; messageId: string; posts: StoredPredictionRevealPost[] }
  >();

  for (const post of posts.toSorted((left, right) => left.matchId.localeCompare(right.matchId))) {
    const key = `${post.threadId}|${post.messageId}`;
    const group = groups.get(key) ?? {
      threadId: post.threadId,
      messageId: post.messageId,
      posts: []
    };

    group.posts.push(post);
    groups.set(key, group);
  }

  return [...groups.values()];
}
