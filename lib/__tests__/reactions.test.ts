import { describe, expect, it } from '@jest/globals';
import { aggregateReactions, toggleReactionState } from '@/lib/reactions';
import type { ReactionRow, ReactionType } from '@/types/social';

const VIEWER = 'user-1';

function row(userId: string, type: ReactionType): ReactionRow {
  return { userId, type };
}

describe('aggregateReactions', () => {
  it('returns zero counts and empty myReactions for empty rows', () => {
    const result = aggregateReactions([], VIEWER);
    expect(result).toEqual({ thumbs_up: 0, thumbs_down: 0, bullseye: 0, fire: 0, myReactions: [] });
  });

  it('counts each type correctly', () => {
    const rows: ReactionRow[] = [
      row('user-2', 'thumbs_up'),
      row('user-3', 'thumbs_up'),
      row('user-4', 'fire'),
    ];
    const result = aggregateReactions(rows, VIEWER);
    expect(result.thumbs_up).toBe(2);
    expect(result.bullseye).toBe(0);
    expect(result.fire).toBe(1);
    expect(result.myReactions).toEqual([]);
  });

  it('collects all current user reactions', () => {
    const rows: ReactionRow[] = [
      row(VIEWER, 'bullseye'),
      row(VIEWER, 'fire'),
      row('user-2', 'thumbs_up'),
    ];
    const result = aggregateReactions(rows, VIEWER);
    expect(result.myReactions).toContain('bullseye');
    expect(result.myReactions).toContain('fire');
    expect(result.myReactions).not.toContain('thumbs_up');
    expect(result.bullseye).toBe(1);
    expect(result.fire).toBe(1);
  });
});

describe('toggleReactionState', () => {
  const base = { thumbs_up: 1, thumbs_down: 0, bullseye: 0, fire: 0, myReactions: [] as ReactionType[] };

  it('adds a reaction when not already active', () => {
    const result = toggleReactionState(base, 'thumbs_up', false);
    expect(result.thumbs_up).toBe(2);
    expect(result.myReactions).toContain('thumbs_up');
  });

  it('removes a reaction when already active', () => {
    const withReaction = { ...base, thumbs_up: 2, myReactions: ['thumbs_up' as ReactionType] };
    const result = toggleReactionState(withReaction, 'thumbs_up', true);
    expect(result.thumbs_up).toBe(1);
    expect(result.myReactions).not.toContain('thumbs_up');
  });

  it('can hold multiple active reactions at once', () => {
    const withOne = { ...base, thumbs_up: 1, myReactions: ['thumbs_up' as ReactionType] };
    const result = toggleReactionState(withOne, 'fire', false);
    expect(result.fire).toBe(1);
    expect(result.myReactions).toContain('thumbs_up');
    expect(result.myReactions).toContain('fire');
  });

  it('does not go below zero when removing', () => {
    const withReaction = { ...base, thumbs_up: 0, myReactions: ['thumbs_up' as ReactionType] };
    const result = toggleReactionState(withReaction, 'thumbs_up', true);
    expect(result.thumbs_up).toBe(0);
    expect(result.myReactions).not.toContain('thumbs_up');
  });
});
