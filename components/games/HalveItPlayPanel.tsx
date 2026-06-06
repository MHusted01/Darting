import { View, Text } from 'react-native';
import { FullBoardInput } from '@/components/games/FullBoardInput';
import { HALVE_IT_TARGETS, HALVE_IT_MAX_ROUNDS } from '@/lib/games/halve-it';
import type { LoadedPlayer } from '@/hooks/usePlaySession';
import type { HalveItPlayerState } from '@/lib/games/halve-it';
import type { DartThrow } from '@/types/game';

interface HalveItPlayPanelProps {
  players: LoadedPlayer[];
  currentPlayerId: number;
  turnDarts: DartThrow[];
  isProcessing: boolean;
  onDartThrown: (dart: DartThrow) => void;
}

function targetLabel(target: (typeof HALVE_IT_TARGETS)[number]): string {
  if (target === 'bull') return 'Bull';
  if (target === 'doubles') return 'Doubles';
  if (target === 'triples') return 'Triples';
  return String(target);
}

export function HalveItPlayPanel({
  players,
  currentPlayerId,
  turnDarts,
  isProcessing,
  onDartThrown,
}: HalveItPlayPanelProps) {
  const currentPlayer = players.find((p) => p.id === currentPlayerId);
  if (!currentPlayer) return null;

  const state = currentPlayer.gameState as HalveItPlayerState;
  const target = HALVE_IT_TARGETS[state.currentRound - 1];

  return (
    <View className="gap-6">
      <View className="items-center">
        <Text className="text-xs font-barlow-semi text-ds-on-surface-variant uppercase tracking-widest mb-1">
          Round {state.currentRound} of {HALVE_IT_MAX_ROUNDS}
        </Text>
        <Text className="text-6xl font-barlow-bold text-ds-on-surface">
          {state.score}
        </Text>
        <Text className="text-sm font-barlow text-ds-on-surface-variant mt-1">
          Target:{' '}
          <Text className="font-barlow-semi text-ds-on-surface">{targetLabel(target)}</Text>
          {' — miss = halve'}
        </Text>
      </View>

      <View className="flex-row justify-center gap-2">
        {Array.from({ length: 3 }).map((_, i) => {
          const dart = turnDarts[i];
          return (
            <View
              key={i}
              className="flex-1 h-10 bg-ds-surface border border-ds-outline-variant rounded-lg items-center justify-center"
            >
              {dart ? (
                <Text className="text-sm font-barlow-semi text-ds-on-surface">
                  {dart.segment === 0
                    ? 'Miss'
                    : dart.multiplier === 1
                      ? String(dart.segment)
                      : dart.multiplier === 2
                        ? `D${dart.segment}`
                        : `T${dart.segment}`}
                </Text>
              ) : (
                <View className="w-2 h-2 rounded-full bg-ds-outline-variant" />
              )}
            </View>
          );
        })}
      </View>

      <FullBoardInput onDartThrown={onDartThrown} isProcessing={isProcessing} />

      <View className="bg-ds-surface border border-ds-outline-variant rounded-xl overflow-hidden">
        {players.map((player, idx) => {
          const ps = player.gameState as HalveItPlayerState;
          const isCurrent = player.id === currentPlayerId;
          return (
            <View
              key={player.id}
              className={`px-4 py-3 flex-row items-center justify-between${idx < players.length - 1 ? ' border-b border-ds-outline-variant' : ''}${isCurrent ? ' bg-ds-red-container' : ''}`}
            >
              <View className="flex-row items-center gap-3">
                <View
                  className="w-8 h-8 rounded-full items-center justify-center"
                  style={{ backgroundColor: player.avatarColor }}
                >
                  <Text className="text-xs font-barlow-semi text-white">
                    {player.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text className="text-sm font-barlow text-ds-on-surface">{player.name}</Text>
              </View>
              <Text className="text-sm font-barlow-semi text-ds-on-surface">
                {ps.score} pts
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
