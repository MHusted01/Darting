export interface Suggestion {
  drillSlug: string;
  reason: string;
  urgency: 'high' | 'medium' | 'low';
}

export interface AggregatedStats {
  gamesPlayed: number;
  x01?: {
    bustRate: number;
    checkoutRate: number;
    doublesHitRate: number;
    threeDartAvg: number;
    /** Fraction of finishable leaves that are preferred doubles (0–1); null if unknown. */
    setupShotQuality?: number | null;
    /** Population standard deviation of turn scores; null if unknown. */
    consistency?: number | null;
  };
  cricket?: {
    marksPerRound: number;
  };
  atcAvgDartsPerNumber?: number;
}

const MIN_GAMES_FOR_SUGGESTIONS = 5;

export function generateSuggestions(stats: AggregatedStats): Suggestion[] {
  if (stats.gamesPlayed < MIN_GAMES_FOR_SUGGESTIONS) return [];

  const suggestions: Suggestion[] = [];

  if (stats.x01) {
    const { bustRate, checkoutRate, doublesHitRate, threeDartAvg } = stats.x01;

    if (bustRate > 0.15) {
      suggestions.push({
        drillSlug: 'reduce-busts',
        reason: `Your bust rate is ${Math.round(bustRate * 100)}% — too many turns going to waste`,
        urgency: bustRate > 0.25 ? 'high' : 'medium',
      });
    }

    if (doublesHitRate < 0.2) {
      suggestions.push({
        drillSlug: 'practice-doubles',
        reason: `Your doubles hit rate is only ${Math.round(doublesHitRate * 100)}% — checkouts are costing you games`,
        urgency: doublesHitRate < 0.1 ? 'high' : 'medium',
      });
    } else if (checkoutRate < 0.2) {
      suggestions.push({
        drillSlug: 'practice-doubles',
        reason: `You finish only ${Math.round(checkoutRate * 100)}% of your checkout attempts — sharpen your doubles`,
        urgency: checkoutRate < 0.1 ? 'high' : 'medium',
      });
    }

    if (threeDartAvg < 45) {
      suggestions.push({
        drillSlug: 'atc-accuracy',
        reason: `Your 3-dart average is ${threeDartAvg.toFixed(1)} — building single-dart accuracy will raise your scoring`,
        urgency: threeDartAvg < 30 ? 'high' : 'medium',
      });
    }

    // Setup-shot quality — are they leaving themselves on workable doubles?
    // Thresholds are initial coaching heuristics and may be tuned with data.
    const { setupShotQuality, consistency } = stats.x01;
    if (setupShotQuality != null && setupShotQuality < 0.6) {
      suggestions.push({
        drillSlug: 'setup-shots',
        reason: `Only ${Math.round(setupShotQuality * 100)}% of your leaves set up a workable double — plan your finishing route`,
        urgency: setupShotQuality < 0.4 ? 'high' : 'medium',
      });
    }

    // Scoring consistency — high turn-score sigma means streaky scoring.
    if (consistency != null && consistency > 30) {
      suggestions.push({
        drillSlug: 'steady-scoring',
        reason: `Your scoring swings a lot (±${Math.round(consistency)} per turn) — grooving a steady rhythm will lift your average`,
        urgency: consistency > 40 ? 'high' : 'medium',
      });
    }
  }

  if (stats.cricket?.marksPerRound !== undefined && stats.cricket.marksPerRound < 3.0) {
    suggestions.push({
      drillSlug: 'cricket-consistency',
      reason: `Your marks per round is ${stats.cricket.marksPerRound.toFixed(1)} — aim for 3+ to stay competitive`,
      urgency: stats.cricket.marksPerRound < 2.0 ? 'high' : 'medium',
    });
  }

  if (stats.atcAvgDartsPerNumber !== undefined && stats.atcAvgDartsPerNumber > 5 && !suggestions.some((s) => s.drillSlug === 'atc-accuracy')) {
    suggestions.push({
      drillSlug: 'atc-accuracy',
      reason: `You average ${stats.atcAvgDartsPerNumber.toFixed(1)} darts per number in Around the Clock — work on single-dart accuracy`,
      urgency: 'low',
    });
  }

  return suggestions;
}
