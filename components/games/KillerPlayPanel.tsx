import { View, Text } from 'react-native';
import { FullBoardInput } from '@/components/games/FullBoardInput';
import { derivePhase } from '@/lib/games/killer';
import type { KillerPlayerState } from '@/lib/games/killer';
import type { LoadedPlayer } from '@/hooks/usePlaySession';
import type { DartThrow } from '@/types/game';

interface KillerPlayPanelProps {
  players: LoadedPlayer[];
  currentPlayerId: number;
  turnDarts: DartThrow[];
  isProcessing: boolean;
  onDartThrown: (dart: DartThrow) => void;
}

function dartLabel(dart: DartThrow): string {
  if (dart.segment === 0) return 'Miss';
  if (dart.multiplier === 2) return `D${dart.segment}`;
  if (dart.multiplier === 3) return `T${dart.segment}`;
  return String(dart.segment);
}

export function KillerPlayPanel({
  players,
  currentPlayerId,
  turnDarts,
  isProcessing,
  onDartThrown,
}: KillerPlayPanelProps) {
  const currentPlayer = players.find((p) => p.id === currentPlayerId);
  if (!currentPlayer) return null;

  const allStates = players.map((p) => p.gameState as KillerPlayerState);
  const state = currentPlayer.gameState as KillerPlayerState;
  const phase = derivePhase(allStates);

  const phaseLabel =
    phase === 'assign'
      ? 'Assign your number'
      : state.isKiller
        ? 'Eliminate!'
        : 'Earn Killer status';

  const dartSlots = 3;

  return (
    <View className="gap-6">
      <View className="items-center">
        <Text className="text-xs font-barlow-semi text-ds-on-surface-variant uppercase tracking-widest mb-1">
          {phaseLabel}
        </Text>
        {phase !== 'assign' && state.assignedNumber !== null && (
          <Text className="text-sm font-barlow text-ds-on-surface-variant">
            Your number:{' '}
            <Text className="font-barlow-semi text-ds-on-surface">
              {state.assignedNumber} {state.isKiller ? '(K)' : ''}
            </Text>
          </Text>
        )}
        {phase === 'assign' && (
          <Text className="text-sm font-barlow text-ds-on-surface-variant mt-1">
            Use non-dominant hand
          </Text>
        )}
      </View>

      <View className="flex-row justify-center gap-2">
        {Array.from({ length: dartSlots }).map((_, i) => {
          const dart = turnDarts[i];
          return (
            <View
              key={i}
              className="flex-1 h-10 bg-ds-surface border border-ds-outline-variant rounded-lg items-center justify-center"
            >
              {dart ? (
                <Text className="text-sm font-barlow-semi text-ds-on-surface">
                  {dartLabel(dart)}
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
          const ps = player.gameState as KillerPlayerState;
          const isCurrent = player.id === currentPlayerId;
          return (
            <View
              key={player.id}
              className={`px-4 py-3 flex-row items-center justify-between${idx < players.length - 1 ? ' border-b border-ds-outline-variant' : ''}${isCurrent ? ' bg-ds-red-container' : ''}${ps.isEliminated ? ' opacity-40' : ''}`}
            >
              <View className="flex-row items-center gap-3">
                <View
                  className="w-8 h-8 rounded-full items-center justify-center"
                  style={{ backgroundColor: player.avatarColor }}
                >
                  <Text className="text-xs font-barlow-semi text-ds-on-red">
                    {player.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View>
                  <Text className="text-sm font-barlow text-ds-on-surface">
                    {player.name}
                    {ps.isKiller ? ' K' : ''}
                  </Text>
                  {ps.assignedNumber !== null && (
                    <Text className="text-xs font-barlow text-ds-on-surface-variant">
                      #{ps.assignedNumber}
                    </Text>
                  )}
                </View>
              </View>
              <View className="flex-row gap-1">
                {Array.from({ length: 3 }).map((_, i) => (
                  <View
                    key={i}
                    className={`w-3 h-3 rounded-full ${i < ps.lives ? 'bg-ds-red' : 'bg-ds-outline-variant'}`}
                  />
                ))}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}
