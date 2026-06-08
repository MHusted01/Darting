export type FeatureName =
  | 'UNLIMITED_STATS_HISTORY'
  | 'CREATE_TOURNAMENT'
  | 'AI_COACHING'
  | 'REALTIME_GAMES'
  | 'CREATE_CLUBS_UNLIMITED'
  | 'JOIN_CLUBS_UNLIMITED';

// Phase 12: swap this body to query RevenueCat entitlements.
export function useFeatureGate(_feature: FeatureName): boolean {
  return true;
}
