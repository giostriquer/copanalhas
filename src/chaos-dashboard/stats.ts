import {
  buildLeaderboard,
  scoreMatch,
  type LeaderboardRow,
  type MatchResult,
  type ScorePrediction
} from "../scoring/scoring.js";
import { formatTeamName } from "../worldcup/team-display.js";
import type { WorldCupMatch } from "../worldcup/types.js";
import type {
  ChaosDashboardModel,
  ChaosLeaderboardRow,
  ChaosMatchAward,
  ChaosPeopleAward,
  ChaosWeeklyMovement,
  ChaosWeeklySnapshotRow
} from "./types.js";

type Outcome = "home" | "away" | "draw";

export interface BuildChaosDashboardModelOptions {
  matches: readonly WorldCupMatch[];
  predictions: readonly ScorePrediction[];
  results: readonly MatchResult[];
  displayNames?: ReadonlyMap<string, string>;
  previousWeekRows: readonly ChaosWeeklySnapshotRow[];
  now: Date;
  timeZone: string;
}

interface UserFinishedStats {
  userId: string;
  finishedPredictions: number;
  zeroPointPredictions: number;
  wrongOutcomes: number;
  totalDistance: number;
  predictedGoals: number;
}

interface MatchStats {
  match: WorldCupMatch;
  result?: MatchResult;
  predictions: ScorePrediction[];
}

const footer = "Zoeira estatistica. Sem apostas, sem dinheiro, so vergonha publica.";
const negativeAwardMinimumFinishedPredictions = 5;

export function buildChaosDashboardModel(
  options: BuildChaosDashboardModelOptions
): ChaosDashboardModel {
  const scoredPredictions = options.results.flatMap((result) =>
    scoreMatch(result, [...options.predictions])
  );
  const leaderboard = buildLeaderboard(scoredPredictions, options.predictions);
  const rankedRows = rankLeaderboardRows(leaderboard, options.displayNames ?? new Map());
  const currentSnapshotRows = createWeeklySnapshotRows(leaderboard);
  const resultIds = new Set(options.results.map((result) => result.matchId));
  const matchStats = options.matches.map((match) => {
    const result = options.results.find((candidate) => candidate.matchId === match.id);

    return {
      match,
      ...(result ? { result } : {}),
      predictions: options.predictions.filter((prediction) => prediction.matchId === match.id)
    };
  });
  const week = weekForDate(options.now, options.timeZone);

  return {
    title: "Copanalhas Recap",
    generatedAtLabel: formatDashboardTimestamp(options.now, options.timeZone),
    week,
    totals: {
      scoredMatches: options.results.length,
      predictions: options.predictions.length,
      finishedPredictions: options.predictions.filter((prediction) => resultIds.has(prediction.matchId))
        .length
    },
    leaderboardTop: rankedRows.slice(0, 5),
    weeklyMovement: buildWeeklyMovement({
      currentRows: currentSnapshotRows,
      leaderboardRows: rankedRows,
      previousRows: options.previousWeekRows,
      displayNames: options.displayNames ?? new Map()
    }),
    peopleAwards: buildPeopleAwards({
      leaderboardRows: rankedRows,
      predictions: options.predictions,
      results: options.results,
      scoredPredictions,
      displayNames: options.displayNames ?? new Map()
    }),
    matchAwards: buildMatchAwards(matchStats),
    footer
  };
}

export function createWeeklySnapshotRows(
  rows: readonly LeaderboardRow[]
): ChaosWeeklySnapshotRow[] {
  return rows.map((row, index) => ({
    userId: row.userId,
    rank: rankForLeaderboardRow(rows, index),
    points: row.points,
    soloCount: row.soloCount,
    exactCount: row.exactCount,
    outcomeCount: row.outcomeCount,
    closestCount: row.closestCount
  }));
}

export function weekStartKey(date: Date, timeZone: string): string {
  return weekForDate(date, timeZone).start;
}

function buildPeopleAwards(options: {
  leaderboardRows: readonly ChaosLeaderboardRow[];
  predictions: readonly ScorePrediction[];
  results: readonly MatchResult[];
  scoredPredictions: ReturnType<typeof scoreMatch>;
  displayNames: ReadonlyMap<string, string>;
}): ChaosPeopleAward[] {
  const statsByUser = userFinishedStats(options);

  return [
    awardFromLeaderboard(
      "profeta-isolado",
      "Profeta isolado",
      options.leaderboardRows,
      (row) => row.soloCount,
      "solos",
      "Cravou sozinho e deixou a mesa olhando torto."
    ),
    awardFromLeaderboard(
      "exatinho-de-condominio",
      "Exatinho de condominio",
      options.leaderboardRows,
      (row) => row.exactCount,
      "exatos",
      "Acertou, mas com testemunhas demais."
    ),
    awardFromLeaderboard(
      "quase-inteligente",
      "Quase inteligente",
      options.leaderboardRows,
      (row) => row.closestCount,
      "pertos",
      "Errou com conviccao estatisticamente aceitavel."
    ),
    awardFromPredictionCounts(
      "cientista-do-empate",
      "Cientista do empate",
      options.predictions,
      options.displayNames,
      (prediction) => outcomeForScore(prediction.homeScore, prediction.awayScore) === "draw",
      "empates",
      "Viu empate onde a vida talvez nao tenha pedido."
    ),
    awardFromUserStats(
      "inimigo-do-obvio",
      "Inimigo do obvio",
      statsByUser,
      options.displayNames,
      (stats) => stats.wrongOutcomes,
      "resultados errados",
      "Escolheu o lado errado com energia."
    ),
    awardFromUserStats(
      "mao-de-alface-estatistica",
      "Mao de alface estatistica",
      statsByUser,
      options.displayNames,
      (stats) =>
        stats.finishedPredictions === 0 ? 0 : stats.totalDistance / stats.finishedPredictions,
      "erro medio",
      "A bola foi para um lado, o palpite para outro bairro.",
      1
    ),
    awardFromUserStats(
      "cravou-nada-falou-tudo",
      "Cravou nada, falou tudo",
      statsByUser,
      options.displayNames,
      (stats) => stats.zeroPointPredictions,
      "zeros",
      "Presenca confirmada, pontos nem tanto."
    ),
    awardFromUserStats(
      "teto-solar-aberto",
      "Teto solar aberto",
      statsByUser,
      options.displayNames,
      (stats) =>
        stats.finishedPredictions === 0 ? 0 : stats.predictedGoals / stats.finishedPredictions,
      "gols previstos/jogo",
      "Todo jogo parecia final de futsal.",
      1
    )
  ];
}

function buildMatchAwards(matchStats: readonly MatchStats[]): ChaosMatchAward[] {
  return [
    matchAward(
      "jogo-do-caos",
      "Jogo do caos",
      matchWithHighestSpread(matchStats),
      "dispersao",
      "Cada um assistiu a um esporte diferente."
    ),
    matchAward(
      "consenso-burro",
      "Consenso burro",
      consensusFailure(matchStats),
      "no consenso errado",
      "A democracia produziu uma derrota coletiva."
    ),
    matchAward(
      "ninguem-viu-essa-bomba",
      "Ninguem viu essa bomba",
      nobodySawItComing(matchStats),
      "erro medio",
      "A partida passou e nao deixou testemunhas."
    ),
    matchAward(
      "bonde-do-mesmo-placar",
      "Bonde do mesmo placar",
      copiedScore(matchStats),
      "palpites iguais",
      "Pensamento independente ficou para semana que vem."
    ),
    matchAward(
      "mesa-dos-profetas",
      "Mesa dos profetas",
      matchWithMostExacts(matchStats),
      "exatos",
      "A mesa inteira viu o roteiro antes do apito."
    )
  ];
}

function userFinishedStats(options: {
  predictions: readonly ScorePrediction[];
  results: readonly MatchResult[];
  scoredPredictions: ReturnType<typeof scoreMatch>;
}): UserFinishedStats[] {
  const resultsByMatch = new Map(options.results.map((result) => [result.matchId, result]));
  const scoredByUserMatch = new Map(
    options.scoredPredictions.map((scored) => [`${scored.userId}|${scored.matchId}`, scored])
  );
  const statsByUser = new Map<string, UserFinishedStats>();

  for (const prediction of options.predictions) {
    const result = resultsByMatch.get(prediction.matchId);

    if (!result) {
      continue;
    }

    const stats = statsByUser.get(prediction.userId) ?? {
      userId: prediction.userId,
      finishedPredictions: 0,
      zeroPointPredictions: 0,
      wrongOutcomes: 0,
      totalDistance: 0,
      predictedGoals: 0
    };
    const distance =
      Math.abs(prediction.homeScore - result.homeScore) +
      Math.abs(prediction.awayScore - result.awayScore);
    const scored = scoredByUserMatch.get(`${prediction.userId}|${prediction.matchId}`);

    stats.finishedPredictions += 1;
    stats.totalDistance += distance;
    stats.predictedGoals += prediction.homeScore + prediction.awayScore;

    if ((scored?.points ?? 0) === 0) {
      stats.zeroPointPredictions += 1;
    }

    if (outcomeForScore(prediction.homeScore, prediction.awayScore) !== outcomeForScore(result.homeScore, result.awayScore)) {
      stats.wrongOutcomes += 1;
    }

    statsByUser.set(prediction.userId, stats);
  }

  return [...statsByUser.values()].filter(
    (stats) => stats.finishedPredictions >= negativeAwardMinimumFinishedPredictions
  );
}

function awardFromLeaderboard(
  key: string,
  title: string,
  rows: readonly ChaosLeaderboardRow[],
  valueForRow: (row: ChaosLeaderboardRow) => number,
  unit: string,
  subtitle: string
): ChaosPeopleAward {
  const row = rows
    .filter((candidate) => valueForRow(candidate) > 0)
    .toSorted((left, right) => valueForRow(right) - valueForRow(left) || left.rank - right.rank)[0];

  if (!row) {
    return emptyPeopleAward(key, title, unit);
  }

  return {
    key,
    title,
    subject: row.displayName,
    value: `${formatNumber(valueForRow(row))} ${unit}`,
    subtitle
  };
}

function awardFromPredictionCounts(
  key: string,
  title: string,
  predictions: readonly ScorePrediction[],
  displayNames: ReadonlyMap<string, string>,
  predicate: (prediction: ScorePrediction) => boolean,
  unit: string,
  subtitle: string
): ChaosPeopleAward {
  const counts = new Map<string, number>();

  for (const prediction of predictions) {
    if (predicate(prediction)) {
      counts.set(prediction.userId, (counts.get(prediction.userId) ?? 0) + 1);
    }
  }

  const winner = [...counts.entries()].toSorted(
    ([leftUser, leftCount], [rightUser, rightCount]) =>
      rightCount - leftCount || leftUser.localeCompare(rightUser)
  )[0];

  if (!winner || winner[1] === 0) {
    return emptyPeopleAward(key, title, unit);
  }

  return {
    key,
    title,
    subject: displayNameForUser(winner[0], displayNames),
    value: `${winner[1]} ${unit}`,
    subtitle
  };
}

function awardFromUserStats(
  key: string,
  title: string,
  stats: readonly UserFinishedStats[],
  displayNames: ReadonlyMap<string, string>,
  valueForStats: (stats: UserFinishedStats) => number,
  unit: string,
  subtitle: string,
  decimals = 0
): ChaosPeopleAward {
  const winner = stats
    .filter((candidate) => valueForStats(candidate) > 0)
    .toSorted(
      (left, right) =>
        valueForStats(right) - valueForStats(left) || left.userId.localeCompare(right.userId)
    )[0];

  if (!winner) {
    return {
      key,
      title,
      subject: "Aguardando mais vergonha",
      value: `min ${negativeAwardMinimumFinishedPredictions} jogos`,
      subtitle
    };
  }

  return {
    key,
    title,
    subject: displayNameForUser(winner.userId, displayNames),
    value: `${formatNumber(valueForStats(winner), decimals)} ${unit}`,
    subtitle
  };
}

function emptyPeopleAward(key: string, title: string, unit: string): ChaosPeopleAward {
  return {
    key,
    title,
    subject: "Sem vitima ainda",
    value: `0 ${unit}`,
    subtitle: "O caos ainda esta carregando."
  };
}

function matchAward(
  key: string,
  title: string,
  winner: MatchAwardWinner | undefined,
  unit: string,
  subtitle: string
): ChaosMatchAward {
  if (!winner) {
    return {
      key,
      title,
      matchLabel: "Aguardando jogos",
      value: `0 ${unit}`,
      subtitle: "O caos dos jogos ainda esta em aquecimento."
    };
  }

  return {
    key,
    title,
    matchLabel: matchLabel(winner.match, winner.result),
    value: `${formatNumber(winner.value, winner.decimals ?? 0)} ${unit}`,
    subtitle
  };
}

function matchWithHighestSpread(matchStats: readonly MatchStats[]): MatchAwardWinner | undefined {
  return bestMatchAward(
    matchStats.filter((stats) => stats.result && stats.predictions.length > 1),
    (stats) => predictionSpread(stats.predictions),
    1
  );
}

function consensusFailure(matchStats: readonly MatchStats[]): MatchAwardWinner | undefined {
  return bestMatchAward(
    matchStats.filter((stats) => {
      if (!stats.result || stats.predictions.length === 0) {
        return false;
      }

      return consensusOutcome(stats.predictions) !== outcomeForScore(stats.result.homeScore, stats.result.awayScore);
    }),
    (stats) => consensusCount(stats.predictions),
    0
  );
}

function nobodySawItComing(matchStats: readonly MatchStats[]): MatchAwardWinner | undefined {
  return bestMatchAward(
    matchStats.filter((stats) => {
      if (!stats.result || stats.predictions.length === 0) {
        return false;
      }

      return !stats.predictions.some(
        (prediction) =>
          prediction.homeScore === stats.result?.homeScore &&
          prediction.awayScore === stats.result.awayScore
      );
    }),
    (stats) => averageDistance(stats),
    1
  );
}

function copiedScore(matchStats: readonly MatchStats[]): MatchAwardWinner | undefined {
  return bestMatchAward(
    matchStats.filter((stats) => stats.predictions.length > 0),
    (stats) => {
      const counts = new Map<string, number>();

      for (const prediction of stats.predictions) {
        const key = `${prediction.homeScore}-${prediction.awayScore}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }

      return Math.max(...counts.values());
    },
    0
  );
}

function matchWithMostExacts(matchStats: readonly MatchStats[]): MatchAwardWinner | undefined {
  return bestMatchAward(
    matchStats.filter((stats) => stats.result !== undefined),
    (stats) =>
      stats.predictions.filter(
        (prediction) =>
          prediction.homeScore === stats.result?.homeScore &&
          prediction.awayScore === stats.result.awayScore
      ).length,
    0
  );
}

interface MatchAwardWinner {
  match: WorldCupMatch;
  result?: MatchResult;
  value: number;
  decimals?: number;
}

function bestMatchAward(
  candidates: readonly MatchStats[],
  valueForStats: (stats: MatchStats) => number,
  decimals: number
): MatchAwardWinner | undefined {
  const winner = candidates
    .map((stats) => ({ stats, value: valueForStats(stats) }))
    .filter((candidate) => candidate.value > 0)
    .toSorted(
      (left, right) =>
        right.value - left.value || left.stats.match.matchNumber - right.stats.match.matchNumber
    )[0];

  if (!winner) {
    return undefined;
  }

  return {
    match: winner.stats.match,
    ...(winner.stats.result ? { result: winner.stats.result } : {}),
    value: winner.value,
    decimals
  };
}

function predictionSpread(predictions: readonly ScorePrediction[]): number {
  let total = 0;
  let pairs = 0;

  for (let leftIndex = 0; leftIndex < predictions.length; leftIndex += 1) {
    const left = predictions[leftIndex];

    if (!left) {
      continue;
    }

    for (let rightIndex = leftIndex + 1; rightIndex < predictions.length; rightIndex += 1) {
      const right = predictions[rightIndex];

      if (!right) {
        continue;
      }

      total += Math.abs(left.homeScore - right.homeScore) + Math.abs(left.awayScore - right.awayScore);
      pairs += 1;
    }
  }

  return pairs === 0 ? 0 : total / pairs;
}

function averageDistance(stats: MatchStats): number {
  if (!stats.result || stats.predictions.length === 0) {
    return 0;
  }

  const total = stats.predictions.reduce(
    (sum, prediction) =>
      sum +
      Math.abs(prediction.homeScore - stats.result!.homeScore) +
      Math.abs(prediction.awayScore - stats.result!.awayScore),
    0
  );

  return total / stats.predictions.length;
}

function consensusOutcome(predictions: readonly ScorePrediction[]): Outcome {
  const counts = outcomeCounts(predictions);

  return [...counts.entries()].toSorted(
    ([leftOutcome, leftCount], [rightOutcome, rightCount]) =>
      rightCount - leftCount || leftOutcome.localeCompare(rightOutcome)
  )[0]?.[0] ?? "draw";
}

function consensusCount(predictions: readonly ScorePrediction[]): number {
  return Math.max(...outcomeCounts(predictions).values());
}

function outcomeCounts(predictions: readonly ScorePrediction[]): Map<Outcome, number> {
  const counts = new Map<Outcome, number>([
    ["home", 0],
    ["draw", 0],
    ["away", 0]
  ]);

  for (const prediction of predictions) {
    const outcome = outcomeForScore(prediction.homeScore, prediction.awayScore);
    counts.set(outcome, (counts.get(outcome) ?? 0) + 1);
  }

  return counts;
}

function buildWeeklyMovement(options: {
  currentRows: readonly ChaosWeeklySnapshotRow[];
  leaderboardRows: readonly ChaosLeaderboardRow[];
  previousRows: readonly ChaosWeeklySnapshotRow[];
  displayNames: ReadonlyMap<string, string>;
}): ChaosWeeklyMovement {
  if (options.previousRows.length === 0) {
    return {
      status: "no-history",
      message: "Sem historico semanal ainda."
    };
  }

  const previousByUser = new Map(options.previousRows.map((row) => [row.userId, row]));
  const leaderboardByUser = new Map(options.leaderboardRows.map((row) => [row.userId, row]));
  const rows = options.currentRows
    .map((row) => {
      const previous = previousByUser.get(row.userId);
      const current = leaderboardByUser.get(row.userId);

      return {
        userId: row.userId,
        displayName: current?.displayName ?? displayNameForUser(row.userId, options.displayNames),
        rank: row.rank,
        previousRank: previous?.rank ?? null,
        movement: previous ? previous.rank - row.rank : 0,
        points: row.points
      };
    });

  return {
    status: "ready",
    climbers: rows
      .filter((row) => row.previousRank !== null && row.movement > 0)
      .toSorted((left, right) => right.movement - left.movement || left.rank - right.rank)
      .slice(0, 3),
    fallers: rows
      .filter((row) => row.previousRank !== null && row.movement < 0)
      .toSorted((left, right) => left.movement - right.movement || right.rank - left.rank)
      .slice(0, 3),
    newcomers: rows.filter((row) => row.previousRank === null).slice(0, 3)
  };
}

function rankLeaderboardRows(
  rows: readonly LeaderboardRow[],
  displayNames: ReadonlyMap<string, string>
): ChaosLeaderboardRow[] {
  return rows.map((row, index) => ({
    ...row,
    rank: rankForLeaderboardRow(rows, index),
    displayName: displayNameForUser(row.userId, displayNames)
  }));
}

function rankForLeaderboardRow(rows: readonly LeaderboardRow[], index: number): number {
  const row = rows[index];
  const previous = rows[index - 1];

  if (!row || !previous || !sameLeaderboardRank(row, previous)) {
    return index + 1;
  }

  return rankForLeaderboardRow(rows, index - 1);
}

function sameLeaderboardRank(left: LeaderboardRow, right: LeaderboardRow): boolean {
  return (
    left.points === right.points &&
    left.soloCount === right.soloCount &&
    left.exactCount === right.exactCount &&
    left.outcomeCount === right.outcomeCount &&
    left.closestCount === right.closestCount
  );
}

function weekForDate(date: Date, timeZone: string): { start: string; end: string; label: string } {
  const local = localDateParts(date, timeZone);
  const localUtcDate = new Date(Date.UTC(local.year, local.month - 1, local.day));
  const mondayOffset = (localUtcDate.getUTCDay() + 6) % 7;
  const start = addUtcDays(localUtcDate, -mondayOffset);
  const end = addUtcDays(start, 6);
  const startKey = dateKey(start);
  const endKey = dateKey(end);

  return {
    start: startKey,
    end: endKey,
    label: `${startKey}..${endKey}`
  };
}

function localDateParts(date: Date, timeZone: string): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  return {
    year: Number(part(parts, "year")),
    month: Number(part(parts, "month")),
    day: Number(part(parts, "day"))
  };
}

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);

  return next;
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function matchLabel(match: WorldCupMatch, result: MatchResult | undefined): string {
  const base = `#${match.matchNumber} ${formatTeamName(match.homeTeam)} x ${formatTeamName(match.awayTeam)}`;

  if (!result) {
    return base;
  }

  return `${base} (${result.homeScore}-${result.awayScore})`;
}

function displayNameForUser(userId: string, displayNames: ReadonlyMap<string, string>): string {
  return normalizeDisplayName(displayNames.get(userId)) || userId;
}

function normalizeDisplayName(value: string | undefined): string {
  return (value ?? "").replace(/\s+/gu, " ").trim();
}

function outcomeForScore(homeScore: number, awayScore: number): Outcome {
  if (homeScore > awayScore) {
    return "home";
  }

  if (awayScore > homeScore) {
    return "away";
  }

  return "draw";
}

function formatNumber(value: number, decimals = 0): string {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

function formatDashboardTimestamp(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZoneName: "short"
  }).formatToParts(date);

  return `${part(parts, "year")}-${part(parts, "month")}-${part(parts, "day")} ${part(
    parts,
    "hour"
  )}:${part(parts, "minute")} ${part(parts, "timeZoneName")}`;
}

function part(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((candidate) => candidate.type === type)?.value ?? "";
}
