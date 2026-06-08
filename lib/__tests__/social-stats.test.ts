import { describe, expect, it } from '@jest/globals';
import { computeCurrentStreak, mapMutualClub, mapRecentGameRow } from '@/lib/social-stats';

function gameOn(isoDate: string) {
  return { completedAt: isoDate };
}

describe('computeCurrentStreak', () => {
  const TODAY = '2026-06-08T14:00:00Z';

  it('returns 0 for empty games list', () => {
    expect(computeCurrentStreak([], TODAY)).toBe(0);
  });

  it('returns 1 when only today has a game', () => {
    expect(computeCurrentStreak([gameOn('2026-06-08T10:00:00Z')], TODAY)).toBe(1);
  });

  it('returns 1 when only yesterday has a game', () => {
    expect(computeCurrentStreak([gameOn('2026-06-07T10:00:00Z')], TODAY)).toBe(1);
  });

  it('returns 2 for today and yesterday', () => {
    expect(computeCurrentStreak([
      gameOn('2026-06-08T10:00:00Z'),
      gameOn('2026-06-07T10:00:00Z'),
    ], TODAY)).toBe(2);
  });

  it('counts multiple games on same day as one streak day', () => {
    expect(computeCurrentStreak([
      gameOn('2026-06-08T09:00:00Z'),
      gameOn('2026-06-08T15:00:00Z'),
      gameOn('2026-06-07T10:00:00Z'),
    ], TODAY)).toBe(2);
  });

  it('breaks streak on a gap', () => {
    expect(computeCurrentStreak([
      gameOn('2026-06-08T10:00:00Z'),
      gameOn('2026-06-06T10:00:00Z'),
    ], TODAY)).toBe(1);
  });

  it('returns 0 when most recent game is 2+ days ago', () => {
    expect(computeCurrentStreak([
      gameOn('2026-06-05T10:00:00Z'),
      gameOn('2026-06-04T10:00:00Z'),
    ], TODAY)).toBe(0);
  });

  it('counts a longer consecutive run', () => {
    expect(computeCurrentStreak([
      gameOn('2026-06-08T10:00:00Z'),
      gameOn('2026-06-07T10:00:00Z'),
      gameOn('2026-06-06T10:00:00Z'),
      gameOn('2026-06-05T10:00:00Z'),
    ], TODAY)).toBe(4);
  });
});

describe('mapRecentGameRow', () => {
  it('maps snake_case row to camelCase RecentGame', () => {
    const row = {
      id: 'session-1',
      game_slug: 'x01-501',
      completed_at: '2026-06-08T10:00:00Z',
      is_winner: true,
      three_dart_avg: 55.0,
    };
    const game = mapRecentGameRow(row);
    expect(game.id).toBe('session-1');
    expect(game.gameSlug).toBe('x01-501');
    expect(game.completedAt).toBe('2026-06-08T10:00:00Z');
    expect(game.isWinner).toBe(true);
    expect(game.threeDartAvg).toBe(55.0);
  });

  it('handles null three_dart_avg', () => {
    const row = { id: 's2', game_slug: 'cricket', completed_at: '2026-06-08T10:00:00Z', is_winner: false, three_dart_avg: null };
    const game = mapRecentGameRow(row);
    expect(game.threeDartAvg).toBeNull();
  });
});

describe('mapMutualClub', () => {
  it('maps id and name', () => {
    const club = mapMutualClub({ id: 'club-1', name: 'Dart Masters' });
    expect(club.id).toBe('club-1');
    expect(club.name).toBe('Dart Masters');
  });
});
