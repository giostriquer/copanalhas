import type { StoredMatchStartAlert, StoredResult } from "../storage/database.js";
import { formatTeamName } from "../worldcup/team-display.js";
import type { WorldCupMatch } from "../worldcup/types.js";

const defaultCazeTvUrl = "https://www.youtube.com/@CazeTV";
const defaultDeleteAfterMinutes = 180;
const defaultStartLeadMinutes = 5;
const defaultStartGraceMinutes = 5;

export interface MatchStartAlertMessage {
  content: string;
  allowedMentions: {
    parse: [];
    roles: string[];
  };
}

export interface MatchStartAlertTickOptions {
  channelId: string;
  roleId: string | null;
  matches: readonly WorldCupMatch[];
  results: readonly StoredResult[];
  alerts: readonly StoredMatchStartAlert[];
  deleteAfterMinutes?: number;
  startLeadMinutes?: number;
  startGraceMinutes?: number;
  cazeTvUrl?: string;
  now(): Date;
  sendAlert(message: MatchStartAlertMessage): Promise<string>;
  deleteAlert(messageId: string): Promise<void>;
  recordAlert(alert: StoredMatchStartAlert): void;
  markAlertDeleted(matchIds: readonly string[], deletedAt: string): void;
}

export interface MatchStartAlertTickResult {
  posted: string[];
  deleted: string[];
  skipped: string[];
}

export async function runMatchStartAlertTick(
  options: MatchStartAlertTickOptions
): Promise<MatchStartAlertTickResult> {
  const now = options.now();
  const nowIso = now.toISOString();
  const posted: string[] = [];
  const deleted = await deleteDueAlerts(options, now, nowIso);

  if (!options.roleId) {
    return { posted, deleted, skipped: [] };
  }

  const dueGroups = groupMatchesByKickoff(dueStartMatches(options, now));

  for (const [kickoffAtUtc, matches] of dueGroups) {
    const messageId = await options.sendAlert(
      formatMatchStartAlertMessage(
        matches,
        options.roleId,
        options.cazeTvUrl ?? defaultCazeTvUrl
      )
    );
    const deleteAfterUtc = addMinutes(
      new Date(kickoffAtUtc),
      options.deleteAfterMinutes ?? defaultDeleteAfterMinutes
    ).toISOString();

    for (const match of matches) {
      options.recordAlert({
        matchId: match.id,
        channelId: options.channelId,
        messageId,
        postedAt: nowIso,
        deleteAfterUtc,
        deletedAt: null
      });
      posted.push(match.id);
    }
  }

  return { posted, deleted, skipped: [] };
}

function dueStartMatches(options: MatchStartAlertTickOptions, now: Date): WorldCupMatch[] {
  const alertedMatchIds = new Set(
    options.alerts
      .filter((alert) => alert.channelId === options.channelId)
      .map((alert) => alert.matchId)
  );
  const resultedMatchIds = new Set(options.results.map((result) => result.matchId));
  const leadMs = (options.startLeadMinutes ?? defaultStartLeadMinutes) * 60 * 1000;
  const graceMs = (options.startGraceMinutes ?? defaultStartGraceMinutes) * 60 * 1000;
  const nowTime = now.getTime();

  return options.matches
    .filter((match) => {
      if (!match.kickoffAtUtc || alertedMatchIds.has(match.id) || resultedMatchIds.has(match.id)) {
        return false;
      }

      const kickoffTime = new Date(match.kickoffAtUtc).getTime();
      const alertStartTime = kickoffTime - leadMs;

      return alertStartTime <= nowTime && nowTime <= kickoffTime + graceMs;
    })
    .toSorted((left, right) => left.matchNumber - right.matchNumber);
}

async function deleteDueAlerts(
  options: MatchStartAlertTickOptions,
  now: Date,
  nowIso: string
): Promise<string[]> {
  const resultMatchIds = new Set(options.results.map((result) => result.matchId));
  const deleted: string[] = [];

  for (const [messageId, alerts] of groupActiveAlertsByMessage(options.alerts, options.channelId)) {
    const allResultsStored = alerts.every((alert) => resultMatchIds.has(alert.matchId));
    const fallbackExpired = alerts.every((alert) => new Date(alert.deleteAfterUtc) <= now);

    if (!allResultsStored && !fallbackExpired) {
      continue;
    }

    await options.deleteAlert(messageId);
    options.markAlertDeleted(
      alerts.map((alert) => alert.matchId),
      nowIso
    );
    deleted.push(messageId);
  }

  return deleted;
}

function formatMatchStartAlertMessage(
  matches: readonly WorldCupMatch[],
  roleId: string,
  cazeTvUrl: string
): MatchStartAlertMessage {
  return {
    content: [
      `<@&${roleId}>`,
      matches.length === 1 ? "PARTIDA COMEÇANDO" : "PARTIDAS COMEÇANDO",
      ...matches.map(
        (match) => `${formatTeamName(match.homeTeam)} x ${formatTeamName(match.awayTeam)}`
      ),
      "",
      `CazeTV: ${cazeTvUrl}`
    ].join("\n"),
    allowedMentions: { parse: [], roles: [roleId] }
  };
}

function groupMatchesByKickoff(matches: readonly WorldCupMatch[]): Map<string, WorldCupMatch[]> {
  const groups = new Map<string, WorldCupMatch[]>();

  for (const match of matches) {
    if (!match.kickoffAtUtc) {
      continue;
    }

    const group = groups.get(match.kickoffAtUtc) ?? [];
    group.push(match);
    groups.set(match.kickoffAtUtc, group);
  }

  return groups;
}

function groupActiveAlertsByMessage(
  alerts: readonly StoredMatchStartAlert[],
  channelId: string
): Map<string, StoredMatchStartAlert[]> {
  const groups = new Map<string, StoredMatchStartAlert[]>();

  for (const alert of alerts) {
    if (alert.channelId !== channelId || alert.deletedAt !== null) {
      continue;
    }

    const group = groups.get(alert.messageId) ?? [];
    group.push(alert);
    groups.set(alert.messageId, group);
  }

  return groups;
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}
