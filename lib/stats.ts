import { and, eq, max, avg, count, sql, inArray, ne, gte, desc } from 'drizzle-orm';
import { db } from '@/db/client';
import { gameSessions, gamePlayers, gameTurns } from '@/db/schema';
import { GAMES } from '@/constants/games';
import type {
  PlayerAnalytics,
  X01KPIs,
  CricketKPIs,
  TargetGameKPIs,
  HighScoreKPIs,
} from '@/lib/games/analytics';
import type { AggregatedStats } from '@/lib/suggestions';

const GAME_NAMES = new Map(GAMES.map((g) => [g.slug, g.name] as const));

export type X01Variant = 501 | 301;

export interface PersonalBestRow {
  gameSlug: string;
  variant: X01Variant | null;
  gamesPlayed: number;
  gamesWon: number;
  bestScore: number | null;
  avgThreeDartAvg: number | null;
}

export interface PersonalBest extends PersonalBestRow {
  gameName: string;
}

import type { SessionContext } from '@/lib/games/analytics';

export interface StatsFilter {
  slug?: string;
  variant?: X01Variant;
  since?: Date;
  context?: SessionContext | 'all';
}

// ---------------------------------------------------------------------------
// New types
// ---------------------------------------------------------------------------

export interface SegmentStat {
  singles: number;
  doubles: number;
  triples: number;
  throwShare: number;
}

export type SegmentAccuracy = Record<string, SegmentStat>;

export interface DoubleEntry {
  segment: number;
  attempts: number;
  successes: number;
  rate: number;
}

export interface CheckoutSummary {
  totalAttempts: number;
  totalSuccesses: number;
  overallRate: number;
  byDouble: Record<string, { attempts: number; successes: number }>;
  bestDoubles: DoubleEntry[];
  worstDoubles: DoubleEntry[];
}

export interface TrendPoint {
  sessionId: number;
  completedAt: number;
  threeDartAvg: number | null;
  gameSlug: string;
}

export type AggregatedKPIs =
  | { type: 'x01'; threeDartAvg: number | null; first9DartAvg: number | null; bustRate: number | null; checkoutRate: number | null; tonCount: number; ton40Count: number; ton80Count: number; highestCheckout: number | null }
  | { type: 'cricket'; marksPerRound: number | null; hitRateBySegment: Record<number, number> }
  | { type: 'target'; overallHitRate: number | null; hitRateByRound: Record<number, { darts: number; hits: number; rate: number }> }
  | { type: 'highscore'; avgPerRound: number | null; bestRound: number | null };

export function computeThreeDartAvg(
  turns: Array<{ darts: number; scoreDelta: number }>,
): number {
  const totalDarts = turns.reduce((sum, t) => sum + t.darts, 0);
  if (totalDarts === 0) return 0;
  const totalScore = turns.reduce((sum, t) => sum + t.scoreDelta, 0);
  return (totalScore / totalDarts) * 3;
}

export function sessionThreeDartAvg(
  gameSlug: string,
  turns: Array<{ darts: number; scoreDelta: number }>,
): number | null {
  return gameSlug === 'x01' ? computeThreeDartAvg(turns) : null;
}

export function resolveTrendSlug(slug: string | undefined): string {
  return slug ?? 'x01';
}

export function resolveX01Variant(gameSlug: string, config: unknown): X01Variant | null {
  if (gameSlug !== 'x01') return null;
  let parsed = config;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      parsed = null;
    }
  }
  if (parsed != null && typeof parsed === 'object') {
    const value = (parsed as { startingScore?: unknown }).startingScore;
    if (value === 301 || value === '301') return 301;
  }
  return 501;
}

export function x01VariantCondition(variant: X01Variant | undefined) {
  if (variant == null) return undefined;
  return sql`COALESCE(json_extract(${gameSessions.config}, '$.startingScore'), 501) = ${variant}`;
}

export function buildPersonalBestsFromRows(rows: PersonalBestRow[]): PersonalBest[] {
  return rows.map((row) => ({
    ...row,
    gameName:
      row.gameSlug === 'x01' && row.variant != null
        ? String(row.variant)
        : (GAME_NAMES.get(row.gameSlug) ?? row.gameSlug),
  }));
}

export async function getPersonalBests(playerId: number): Promise<PersonalBest[]> {
  const variantExpr = sql<number | null>`CASE WHEN ${gameSessions.gameSlug} = 'x01' THEN COALESCE(json_extract(${gameSessions.config}, '$.startingScore'), 501) ELSE NULL END`;

  const rows = await db
    .select({
      gameSlug: gameSessions.gameSlug,
      variant: variantExpr,
      gamesPlayed: sql<number>`count(DISTINCT ${gameSessions.id})`,
      gamesWon: sql<number>`sum(${gamePlayers.isWinner})`,
      bestScore: max(gamePlayers.currentScore),
      avgThreeDartAvg: avg(gamePlayers.threeDartAvg),
    })
    .from(gameSessions)
    .innerJoin(gamePlayers, eq(gamePlayers.gameSessionId, gameSessions.id))
    .where(and(eq(gameSessions.status, 'completed'), eq(gamePlayers.playerId, playerId)))
    .groupBy(gameSessions.gameSlug, variantExpr);

  const mapped: PersonalBestRow[] = rows.map((r) => ({
    gameSlug: r.gameSlug,
    variant: r.gameSlug === 'x01' ? (Number(r.variant) === 301 ? 301 : 501) : null,
    gamesPlayed: r.gamesPlayed,
    gamesWon: Number(r.gamesWon ?? 0),
    bestScore: r.bestScore ?? null,
    avgThreeDartAvg: r.avgThreeDartAvg != null ? Number(r.avgThreeDartAvg) : null,
  }));

  return buildPersonalBestsFromRows(mapped);
}

export async function getOverallThreeDartAvg(
  playerId: number,
  variant: X01Variant | 'all' = 501,
): Promise<number | null> {
  const [result] = await db
    .select({ value: avg(gamePlayers.threeDartAvg) })
    .from(gamePlayers)
    .innerJoin(gameSessions, eq(gameSessions.id, gamePlayers.gameSessionId))
    .where(
      and(
        eq(gameSessions.status, 'completed'),
        eq(gamePlayers.playerId, playerId),
        eq(gameSessions.gameSlug, 'x01'),
        x01VariantCondition(variant === 'all' ? undefined : variant),
      ),
    );

  if (result?.value == null) return null;
  const n = Number(result.value);
  return Number.isFinite(n) ? n : null;
}

export async function getSessionThreeDartAvg(
  sessionId: number,
  playerId: number,
): Promise<number | null> {
  const turns = await db
    .select({ darts: gameTurns.darts, scoreDelta: gameTurns.scoreDelta })
    .from(gameTurns)
    .where(and(eq(gameTurns.gameSessionId, sessionId), eq(gameTurns.playerId, playerId)));

  const playerTurns = turns.map((t) => {
    const d = t.darts as Array<{ segment: number; multiplier: number }>;
    return { darts: d.length, scoreDelta: t.scoreDelta };
  });

  if (playerTurns.length === 0) return null;
  const avg = computeThreeDartAvg(playerTurns);
  return Number.isFinite(avg) ? avg : null;
}

// ---------------------------------------------------------------------------
// Internal utilities
// ---------------------------------------------------------------------------

function numAvg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

function numSum(nums: number[]): number {
  return nums.reduce((s, n) => s + n, 0);
}

function nullableAvg(nums: Array<number | null>): number | null {
  const valid = nums.filter((n): n is number => n !== null);
  if (valid.length === 0) return null;
  return numAvg(valid);
}

function nullableMax(nums: Array<number | null>): number | null {
  const valid = nums.filter((n): n is number => n !== null);
  if (valid.length === 0) return null;
  return Math.max(...valid);
}

function isX01KPIs(kpis: PlayerAnalytics['perGameKPIs']): kpis is X01KPIs {
  return typeof (kpis as X01KPIs).bustRate === 'number';
}

function isCricketKPIs(kpis: PlayerAnalytics['perGameKPIs']): kpis is CricketKPIs {
  return typeof (kpis as CricketKPIs).marksPerRound === 'number';
}

function isTargetGameKPIs(kpis: PlayerAnalytics['perGameKPIs']): kpis is TargetGameKPIs {
  return 'hitRateByRound' in kpis;
}

function isHighScoreKPIs(kpis: PlayerAnalytics['perGameKPIs']): kpis is HighScoreKPIs {
  return typeof (kpis as HighScoreKPIs).bestRound === 'number' && !('hitRateByRound' in kpis);
}

const TARGET_GAME_SLUGS = new Set([
  'around-the-clock',
  'shanghai',
  'baseball',
  'bobs-27',
  'bermuda-triangle',
  'halve-it',
]);

const MIN_CHECKOUT_ATTEMPTS = 3;

// ---------------------------------------------------------------------------
// Pure aggregation helpers (exported for unit testing)
// ---------------------------------------------------------------------------

export function aggregateSegmentAccuracy(
  rows: Array<{ analytics: PlayerAnalytics | null }>,
): SegmentAccuracy {
  const totals: Record<string, { singles: number; doubles: number; triples: number }> = {};
  let totalThrows = 0;

  for (const row of rows) {
    const dartCounts = row.analytics?.dartCounts;
    if (!dartCounts) continue;
    for (const [key, counts] of Object.entries(dartCounts)) {
      if (!totals[key]) totals[key] = { singles: 0, doubles: 0, triples: 0 };
      totals[key].singles += counts.singles;
      totals[key].doubles += counts.doubles;
      totals[key].triples += counts.triples;
      totalThrows += counts.singles + counts.doubles + counts.triples;
    }
  }

  const result: SegmentAccuracy = {};
  for (const [key, counts] of Object.entries(totals)) {
    const throws = counts.singles + counts.doubles + counts.triples;
    result[key] = {
      ...counts,
      // throwShare = proportion of all recorded throws that landed on this segment
      throwShare: totalThrows > 0 ? throws / totalThrows : 0,
    };
  }
  return result;
}

export function buildCheckoutBestWorst(
  byDouble: Record<string, { attempts: number; successes: number }>,
): { best: DoubleEntry[]; worst: DoubleEntry[] } {
  const entries: DoubleEntry[] = Object.entries(byDouble)
    .filter(([, d]) => d.attempts >= MIN_CHECKOUT_ATTEMPTS)
    .map(([seg, d]) => ({
      segment: Number(seg),
      attempts: d.attempts,
      successes: d.successes,
      rate: d.attempts > 0 ? d.successes / d.attempts : 0,
    }));

  const byRateDesc = [...entries].sort((a, b) => b.rate - a.rate);
  const byRateAsc = [...entries].sort((a, b) => a.rate - b.rate);

  return { best: byRateDesc.slice(0, 3), worst: byRateAsc.slice(0, 3) };
}

export function aggregateCheckoutStats(
  rows: Array<{ analytics: PlayerAnalytics | null }>,
): CheckoutSummary {
  const byDouble: Record<string, { attempts: number; successes: number }> = {};
  let totalAttempts = 0;
  let totalSuccesses = 0;

  for (const row of rows) {
    const cs = row.analytics?.checkoutStats;
    if (!cs) continue;
    totalAttempts += cs.attempts;
    totalSuccesses += cs.successes;
    for (const [seg, data] of Object.entries(cs.byDouble as Record<string, { attempts: number; successes: number }>)) {
      if (!byDouble[seg]) byDouble[seg] = { attempts: 0, successes: 0 };
      byDouble[seg].attempts += data.attempts;
      byDouble[seg].successes += data.successes;
    }
  }

  const { best, worst } = buildCheckoutBestWorst(byDouble);

  return {
    totalAttempts,
    totalSuccesses,
    overallRate: totalAttempts > 0 ? totalSuccesses / totalAttempts : 0,
    byDouble,
    bestDoubles: best,
    worstDoubles: worst,
  };
}

export function aggregatePerGameKPIs(
  rows: Array<{ analytics: PlayerAnalytics | null; gameSlug: string }>,
  gameSlug: string,
): AggregatedKPIs | null {
  const matching = rows.filter(
    (r) => r.gameSlug === gameSlug && r.analytics != null,
  );
  if (matching.length === 0) return null;

  const kpis = matching.map((r) => r.analytics!.perGameKPIs);

  if (gameSlug === 'x01') {
    const x01s = kpis.filter(isX01KPIs);
    if (x01s.length === 0) return null;
    // bustRate and checkoutRate are simple averages across sessions (unweighted by session length).
    // Sessions with more turns would ideally carry more weight, but X01KPIs only stores the
    // pre-computed rates, not the raw counts. Acceptable for coaching purposes at typical session sizes.
    return {
      type: 'x01',
      threeDartAvg: numAvg(x01s.map((k) => k.threeDartAvg)),
      first9DartAvg: nullableAvg(x01s.map((k) => k.first9DartAvg)),
      bustRate: numAvg(x01s.map((k) => k.bustRate)),
      checkoutRate: numAvg(x01s.map((k) => k.checkoutRate)),
      tonCount: numSum(x01s.map((k) => k.tonCount)),
      ton40Count: numSum(x01s.map((k) => k.ton40Count)),
      ton80Count: numSum(x01s.map((k) => k.ton80Count)),
      highestCheckout: nullableMax(x01s.map((k) => k.highestCheckout)),
    };
  }

  if (gameSlug === 'cricket') {
    const crickets = kpis.filter(isCricketKPIs);
    if (crickets.length === 0) return null;
    const segRates: Record<number, number[]> = {};
    for (const c of crickets) {
      for (const [seg, rate] of Object.entries(c.hitRateBySegment)) {
        const n = Number(seg);
        if (!segRates[n]) segRates[n] = [];
        segRates[n].push(rate);
      }
    }
    const hitRateBySegment: Record<number, number> = {};
    for (const [seg, rates] of Object.entries(segRates)) {
      hitRateBySegment[Number(seg)] = numAvg(rates);
    }
    return {
      type: 'cricket',
      marksPerRound: numAvg(crickets.map((k) => k.marksPerRound)),
      hitRateBySegment,
    };
  }

  if (TARGET_GAME_SLUGS.has(gameSlug)) {
    const targets = kpis.filter(isTargetGameKPIs);
    if (targets.length === 0) return null;
    const roundTotals: Record<number, { darts: number; hits: number }> = {};
    for (const t of targets) {
      for (const [round, data] of Object.entries(t.hitRateByRound)) {
        const r = Number(round);
        if (!roundTotals[r]) roundTotals[r] = { darts: 0, hits: 0 };
        roundTotals[r].darts += data.darts;
        roundTotals[r].hits += data.hits;
      }
    }
    const hitRateByRound: Record<number, { darts: number; hits: number; rate: number }> = {};
    for (const [round, data] of Object.entries(roundTotals)) {
      hitRateByRound[Number(round)] = {
        ...data,
        rate: data.darts > 0 ? data.hits / data.darts : 0,
      };
    }
    const totalDarts = Object.values(roundTotals).reduce((s, r) => s + r.darts, 0);
    const totalHits = Object.values(roundTotals).reduce((s, r) => s + r.hits, 0);
    return {
      type: 'target',
      overallHitRate: totalDarts > 0 ? totalHits / totalDarts : null,
      hitRateByRound,
    };
  }

  if (gameSlug === 'high-score') {
    const hs = kpis.filter(isHighScoreKPIs);
    if (hs.length === 0) return null;
    return {
      type: 'highscore',
      avgPerRound: numAvg(hs.map((k) => k.avgPerRound)),
      bestRound: nullableMax(hs.map((k) => k.bestRound)) ?? null,
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Shared DB query helper
// ---------------------------------------------------------------------------

interface SessionRow {
  analytics: PlayerAnalytics | null;
  gameSlug: string;
  sessionId: number;
  completedAt: number;
  threeDartAvg: number | null;
}

type SessionStatus = 'setup' | 'in_progress' | 'completed' | 'abandoned';

async function fetchPlayerSessionRows(
  playerId: number,
  filter?: StatsFilter,
  statuses: SessionStatus[] = ['completed'],
): Promise<SessionRow[]> {
  const rows = await db
    .select({
      analytics: gamePlayers.analytics,
      gameSlug: gameSessions.gameSlug,
      sessionId: gameSessions.id,
      completedAt: gameSessions.completedAt,
      threeDartAvg: gamePlayers.threeDartAvg,
    })
    .from(gamePlayers)
    .innerJoin(gameSessions, eq(gameSessions.id, gamePlayers.gameSessionId))
    .where(
      and(
        eq(gamePlayers.playerId, playerId),
        inArray(gameSessions.status, statuses),
        filter?.since
          ? gte(gameSessions.completedAt, filter.since)
          : undefined,
        filter?.context === 'all'
          ? undefined
          : filter?.context
            ? eq(gameSessions.context, filter.context)
            : ne(gameSessions.context, 'practice'),
        filter?.slug ? eq(gameSessions.gameSlug, filter.slug) : undefined,
        x01VariantCondition(filter?.slug === 'x01' ? filter.variant : undefined),
      ),
    );

  return rows.map((r) => ({
    analytics: (r.analytics as PlayerAnalytics | null) ?? null,
    gameSlug: r.gameSlug,
    sessionId: r.sessionId,
    completedAt: r.completedAt instanceof Date ? r.completedAt.getTime() : (r.completedAt ?? 0),
    threeDartAvg: r.threeDartAvg ?? null,
  }));
}

// ---------------------------------------------------------------------------
// DB-querying functions
// ---------------------------------------------------------------------------

export async function getSegmentAccuracy(
  playerId: number,
  filter?: StatsFilter,
): Promise<SegmentAccuracy> {
  const rows = await fetchPlayerSessionRows(playerId, filter, ['completed']);
  return aggregateSegmentAccuracy(rows);
}

export async function getCheckoutStats(playerId: number, filter?: StatsFilter): Promise<CheckoutSummary> {
  const rows = await fetchPlayerSessionRows(playerId, { ...filter, slug: 'x01' }, ['completed']);
  return aggregateCheckoutStats(rows);
}

export async function getPerGameKPIs(
  playerId: number,
  gameSlug: string,
  filter?: StatsFilter,
): Promise<AggregatedKPIs | null> {
  const rows = await fetchPlayerSessionRows(playerId, { ...filter, slug: gameSlug }, ['completed']);
  return aggregatePerGameKPIs(rows, gameSlug);
}

export async function getTrendData(
  playerId: number,
  limit: number,
  filter?: StatsFilter,
): Promise<TrendPoint[]> {
  const rows = await db
    .select({
      sessionId: gameSessions.id,
      completedAt: gameSessions.completedAt,
      threeDartAvg: gamePlayers.threeDartAvg,
      gameSlug: gameSessions.gameSlug,
    })
    .from(gamePlayers)
    .innerJoin(gameSessions, eq(gameSessions.id, gamePlayers.gameSessionId))
    .where(
      and(
        eq(gamePlayers.playerId, playerId),
        eq(gameSessions.status, 'completed'),
        eq(gameSessions.gameSlug, resolveTrendSlug(filter?.slug)),
        x01VariantCondition(resolveTrendSlug(filter?.slug) === 'x01' ? filter?.variant : undefined),
        filter?.since ? gte(gameSessions.completedAt, filter.since) : undefined,
        filter?.context === 'all'
          ? undefined
          : filter?.context
            ? eq(gameSessions.context, filter.context)
            : ne(gameSessions.context, 'practice'),
      ),
    )
    .orderBy(desc(gameSessions.completedAt))
    .limit(limit);

  return rows.map((r) => ({
    sessionId: r.sessionId,
    completedAt: r.completedAt instanceof Date ? r.completedAt.getTime() : (r.completedAt ?? 0),
    threeDartAvg: r.threeDartAvg ?? null,
    gameSlug: r.gameSlug,
  }));
}

export async function getAggregatedStats(
  playerId: number,
  filter?: StatsFilter,
): Promise<AggregatedStats> {
  const rows = await fetchPlayerSessionRows(playerId, filter, ['completed']);
  const gamesPlayed = rows.length;

  const x01Rows = rows.filter((r) => r.gameSlug === 'x01');
  const cricketRows = rows.filter((r) => r.gameSlug === 'cricket');
  const atcRows = rows.filter((r) => r.gameSlug === 'around-the-clock');

  let x01Result: AggregatedStats['x01'] | undefined;
  if (x01Rows.length > 0) {
    const kpiResult = aggregatePerGameKPIs(x01Rows, 'x01');
    if (kpiResult?.type === 'x01') {
      let totalDoubles = 0;
      let totalThrows = 0;
      for (const r of x01Rows) {
        const dartCounts = r.analytics?.dartCounts;
        if (!dartCounts) continue;
        for (const counts of Object.values(dartCounts)) {
          totalDoubles += counts.doubles;
          totalThrows += counts.singles + counts.doubles + counts.triples;
        }
      }
      x01Result = {
        bustRate: kpiResult.bustRate ?? 0,
        checkoutRate: kpiResult.checkoutRate ?? 0,
        doublesHitRate: totalThrows > 0 ? totalDoubles / totalThrows : 0,
        threeDartAvg: kpiResult.threeDartAvg ?? 0,
      };
    }
  }

  let cricketResult: AggregatedStats['cricket'] | undefined;
  if (cricketRows.length > 0) {
    const kpiResult = aggregatePerGameKPIs(cricketRows, 'cricket');
    if (kpiResult?.type === 'cricket') {
      cricketResult = { marksPerRound: kpiResult.marksPerRound ?? 0 };
    }
  }

  let atcAvgDartsPerNumber: number | undefined;
  if (atcRows.length > 0) {
    let totalDarts = 0;
    let totalHits = 0;
    for (const r of atcRows) {
      const kpis = r.analytics?.perGameKPIs;
      if (!kpis || !isTargetGameKPIs(kpis)) continue;
      totalDarts += kpis.totalDarts;
      totalHits += kpis.totalHits;
    }
    atcAvgDartsPerNumber = totalHits > 0 ? totalDarts / totalHits : undefined;
  }

  return { gamesPlayed, x01: x01Result, cricket: cricketResult, atcAvgDartsPerNumber };
}
