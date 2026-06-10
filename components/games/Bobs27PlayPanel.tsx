import { View, Text } from 'react-native';
import { MAX_FONT_SCALE_DENSE } from '@/constants/typography';
import { FullBoardInput } from '@/components/games/FullBoardInput';
import { BOBS_27_MAX_ROUNDS } from '@/lib/games/bobs-27';
import type { LoadedPlayer } from '@/hooks/usePlaySession';
import type { Bobs27PlayerState } from '@/lib/games/bobs-27';
import type { DartThrow } from '@/types/game';

interface Bobs27PlayPanelProps {
  players: LoadedPlayer[];
  currentPlayerId: number;
  turnDarts: DartThrow[];
  isProcessing: boolean;
  onDartThrown: (dart: DartThrow) => void;
}

export function Bobs27PlayPanel({
  players,
  currentPlayerId,
  turnDarts,
  isProcessing,
  onDartThrown,
}: Bobs27PlayPanelProps) {
  const currentPlayer = players.find((p) => p.id === currentPlayerId);
  if (!currentPlayer) return null;

  const state = currentPlayer.gameState as Bobs27PlayerState;
  const round = state.currentRound;

  return (
    <View className="gap-6">
      <View className="items-center">
        <Text className="text-xs font-barlow-semi text-ds-on-surface-variant uppercase tracking-widest mb-1">
          Round {round} of {BOBS_27_MAX_ROUNDS}
        </Text>
        {state.eliminated ? (
          <Text className="text-2xl font-barlow-semi text-ds-red">Eliminated</Text>
        ) : (
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE_DENSE} className="text-6xl font-barlow-bold text-ds-on-surface">
            {state.score}
          </Text>
        )}
        <Text className="text-sm font-barlow text-ds-on-surface-variant mt-1">
          Target:{' '}
          <Text className="font-barlow-semi text-ds-on-surface">Double {round}</Text>
          {' — miss = −'}{2 * round}
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

      {!state.eliminated && (
        <FullBoardInput onDartThrown={onDartThrown} isProcessing={isProcessing} />
      )}

      <View className="bg-ds-surface border border-ds-outline-variant rounded-xl overflow-hidden">
        {players.map((player, idx) => {
          const ps = player.gameState as Bobs27PlayerState;
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
                  <Text className="text-xs font-barlow-semi text-ds-on-red">
                    {player.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text className={`text-sm font-barlow ${ps.eliminated ? 'text-ds-on-surface-variant line-through' : 'text-ds-on-surface'}`}>
                  {player.name}
                </Text>
              </View>
              <Text className="text-sm font-barlow-semi text-ds-on-surface">
                {ps.eliminated ? 'Out' : `${ps.score} pts`}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
