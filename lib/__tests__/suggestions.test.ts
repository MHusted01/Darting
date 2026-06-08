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
