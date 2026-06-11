import { describe, expect, it } from '@jest/globals';
import {
  generateSuggestions,
  type AggregatedStats,
} from '@/lib/suggestions';

function makeStats(overrides: Partial<AggregatedStats> = {}): AggregatedStats {
  return {
    gamesPlayed: 10,
    x01: { bustRate: 0.05, checkoutRate: 0.5, doublesHitRate: 0.4, threeDartAvg: 55 },
    cricket: { marksPerRound: 4.5 },
    atcAvgDartsPerNumber: 3.2,
    ...overrides,
  };
}

describe('generateSuggestions', () => {
  it('returns no suggestions for strong all-around stats', () => {
    const suggestions = generateSuggestions(makeStats());
    expect(suggestions).toHaveLength(0);
  });

  it('returns no suggestions when fewer than 5 games played', () => {
    const stats = makeStats({ gamesPlayed: 3, x01: { bustRate: 0.5, checkoutRate: 0.1, doublesHitRate: 0.05, threeDartAvg: 20 } });
    const suggestions = generateSuggestions(stats);
    expect(suggestions).toHaveLength(0);
  });

  it('suggests practicing doubles when X01 doubles hit rate is below 20%', () => {
    const stats = makeStats({ x01: { bustRate: 0.05, checkoutRate: 0.5, doublesHitRate: 0.15, threeDartAvg: 55 } });
    const suggestions = generateSuggestions(stats);
    const slugs = suggestions.map((s) => s.drillSlug);
    expect(slugs).toContain('practice-doubles');
  });

  it('suggests reducing busts when X01 bust rate is above 15%', () => {
    const stats = makeStats({ x01: { bustRate: 0.2, checkoutRate: 0.5, doublesHitRate: 0.4, threeDartAvg: 55 } });
    const suggestions = generateSuggestions(stats);
    const slugs = suggestions.map((s) => s.drillSlug);
    expect(slugs).toContain('reduce-busts');
  });

  it('suggests cricket consistency when marks per round is below 3.0', () => {
    const stats = makeStats({ cricket: { marksPerRound: 2.5 } });
    const suggestions = generateSuggestions(stats);
    const slugs = suggestions.map((s) => s.drillSlug);
    expect(slugs).toContain('cricket-consistency');
  });

  it('suggests ATC accuracy when average darts per number is high (> 5)', () => {
    const stats = makeStats({ atcAvgDartsPerNumber: 7 });
    const suggestions = generateSuggestions(stats);
    const slugs = suggestions.map((s) => s.drillSlug);
    expect(slugs).toContain('atc-accuracy');
  });

  it('can trigger multiple suggestions at once', () => {
    const stats = makeStats({
      x01: { bustRate: 0.25, checkoutRate: 0.1, doublesHitRate: 0.1, threeDartAvg: 55 },
      cricket: { marksPerRound: 2.0 },
    });
    const suggestions = generateSuggestions(stats);
    expect(suggestions.length).toBeGreaterThanOrEqual(2);
  });

  it('does not emit duplicate drillSlugs when both threeDartAvg and atcAvgDartsPerNumber trigger atc-accuracy', () => {
    const stats = makeStats({
      x01: { bustRate: 0.05, checkoutRate: 0.5, doublesHitRate: 0.4, threeDartAvg: 35 },
      atcAvgDartsPerNumber: 7,
    });
    const suggestions = generateSuggestions(stats);
    const slugs = suggestions.map((s) => s.drillSlug);
    expect(slugs.filter((slug) => slug === 'atc-accuracy')).toHaveLength(1);
  });

  it('suggests setup-shot work when setup-shot quality is low', () => {
    const stats = makeStats({
      x01: { bustRate: 0.05, checkoutRate: 0.5, doublesHitRate: 0.4, threeDartAvg: 55, setupShotQuality: 0.3 },
    });
    const suggestions = generateSuggestions(stats);
    const setup = suggestions.find((s) => s.drillSlug === 'setup-shots');
    expect(setup).toBeDefined();
    expect(setup?.urgency).toBe('high'); // < 0.4 is high
  });

  it('uses medium urgency for moderately low setup-shot quality', () => {
    const stats = makeStats({
      x01: { bustRate: 0.05, checkoutRate: 0.5, doublesHitRate: 0.4, threeDartAvg: 55, setupShotQuality: 0.5 },
    });
    const setup = generateSuggestions(stats).find((s) => s.drillSlug === 'setup-shots');
    expect(setup?.urgency).toBe('medium'); // 0.4 ≤ x < 0.6
  });

  it('does not suggest setup-shot work when quality is good or unknown', () => {
    const good = generateSuggestions(
      makeStats({ x01: { bustRate: 0.05, checkoutRate: 0.5, doublesHitRate: 0.4, threeDartAvg: 55, setupShotQuality: 0.8 } }),
    );
    expect(good.some((s) => s.drillSlug === 'setup-shots')).toBe(false);
    // null/undefined setupShotQuality must not trigger
    const unknown = generateSuggestions(makeStats());
    expect(unknown.some((s) => s.drillSlug === 'setup-shots')).toBe(false);
  });

  it('suggests steady scoring when consistency (sigma) is high', () => {
    const stats = makeStats({
      x01: { bustRate: 0.05, checkoutRate: 0.5, doublesHitRate: 0.4, threeDartAvg: 55, consistency: 45 },
    });
    const steady = generateSuggestions(stats).find((s) => s.drillSlug === 'steady-scoring');
    expect(steady).toBeDefined();
    expect(steady?.urgency).toBe('high'); // > 40 is high
  });

  it('does not suggest steady scoring when consistency is tight or unknown', () => {
    const tight = generateSuggestions(
      makeStats({ x01: { bustRate: 0.05, checkoutRate: 0.5, doublesHitRate: 0.4, threeDartAvg: 55, consistency: 15 } }),
    );
    expect(tight.some((s) => s.drillSlug === 'steady-scoring')).toBe(false);
    const unknown = generateSuggestions(makeStats());
    expect(unknown.some((s) => s.drillSlug === 'steady-scoring')).toBe(false);
  });

  it('each suggestion has drillSlug, reason, and urgency', () => {
    const stats = makeStats({ x01: { bustRate: 0.3, checkoutRate: 0.1, doublesHitRate: 0.1, threeDartAvg: 55 } });
    const suggestions = generateSuggestions(stats);
    for (const s of suggestions) {
      expect(typeof s.drillSlug).toBe('string');
      expect(typeof s.reason).toBe('string');
      expect(['high', 'medium', 'low']).toContain(s.urgency);
    }
  });
});
