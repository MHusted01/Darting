import { View, Text } from 'react-native';
import { MAX_FONT_SCALE_DENSE } from '@/constants/typography';
import { FullBoardInput } from '@/components/games/FullBoardInput';
import { BERMUDA_TRIANGLE_TARGETS, BERMUDA_TRIANGLE_MAX_ROUNDS } from '@/lib/games/bermuda-triangle';
import type { LoadedPlayer } from '@/hooks/usePlaySession';
import type { BermudaTrianglePlayerState } from '@/lib/games/bermuda-triangle';
import type { DartThrow } from '@/types/game';

interface BermudaTrianglePlayPanelProps {
  players: LoadedPlayer[];
  currentPlayerId: number;
  turnDarts: DartThrow[];
  isProcessing: boolean;
  onDartThrown: (dart: DartThrow) => void;
}

function targetLabel(target: number): string {
  return target === 25 ? 'Bull' : String(target);
}

function dartLabel(dart: DartThrow): string {
  if (dart.segment === 0) return 'Miss';
  if (dart.multiplier === 2) return `D${dart.segment}`;
  if (dart.multiplier === 3) return `T${dart.segment}`;
  return String(dart.segment);
}

export function BermudaTrianglePlayPanel({
  players,
  currentPlayerId,
  turnDarts,
  isProcessing,
  onDartThrown,
}: BermudaTrianglePlayPanelProps) {
  const currentPlayer = players.find((p) => p.id === currentPlayerId);
  if (!currentPlayer) return null;

  const state = currentPlayer.gameState as BermudaTrianglePlayerState;
  const roundIndex = state.currentRound - 1;
  if (roundIndex < 0 || roundIndex >= BERMUDA_TRIANGLE_TARGETS.length) return null;
  const target = BERMUDA_TRIANGLE_TARGETS[roundIndex];

  return (
    <View className="gap-6">
      <View className="items-center">
        <Text className="text-xs font-barlow-semi text-ds-on-surface-variant uppercase tracking-widest mb-1">
          Round {state.currentRound} of {BERMUDA_TRIANGLE_MAX_ROUNDS}
        </Text>
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE_DENSE} className="text-6xl font-barlow-bold text-ds-on-surface">
          {state.totalScore}
        </Text>
        <Text className="text-sm font-barlow text-ds-on-surface-variant mt-1">
          Target:{' '}
          <Text className="font-barlow-semi text-ds-on-surface">{targetLabel(target)}</Text>
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
          const ps = player.gameState as BermudaTrianglePlayerState;
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
                {ps.totalScore} pts
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
