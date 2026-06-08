import type { AggregatedReactions, ReactionRow, ReactionType } from '@/types/social';

export function aggregateReactions(rows: ReactionRow[], currentUserId: string): AggregatedReactions {
  const counts: AggregatedReactions = { thumbs_up: 0, bullseye: 0, fire: 0, thumbs_down: 0, myReactions: [] };
  for (const row of rows) {
    counts[row.type] += 1;
    if (row.userId === currentUserId) {
      counts.myReactions = [...counts.myReactions, row.type];
    }
  }
  return counts;
}

export function toggleReactionState(
  current: AggregatedReactions,
  type: ReactionType,
  isActive: boolean,
): AggregatedReactions {
  if (isActive) {
    return {
      ...current,
      [type]: Math.max(0, current[type] - 1),
      myReactions: current.myReactions.filter((r) => r !== type),
    };
  }
  if (current.myReactions.includes(type)) return current;
  return {
    ...current,
    [type]: current[type] + 1,
    myReactions: [...current.myReactions, type],
  };
}
