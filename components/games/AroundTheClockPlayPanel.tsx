import { View, Text } from 'react-native';
import { MAX_FONT_SCALE_DENSE } from '@/constants/typography';
import { AroundTheClockInput } from '@/components/games/AroundTheClockInput';
import { getTargetLabel, type AroundTheClockPlayerState } from '@/lib/games/around-the-clock';
import type { DartThrow } from '@/types/game';

interface AroundTheClockPanelPlayer {
  id: number;
  name: string;
  avatarColor: string;
  gameState: unknown;
}

interface AroundTheClockPlayPanelProps {
  players: AroundTheClockPanelPlayer[];
  currentPlayerId: number;
  localTarget: number;
  maxTarget: number;
  turnDarts: DartThrow[];
  isProcessing: boolean;
  onDartThrown: (dart: DartThrow) => void | Promise<void>;
}

export function AroundTheClockPlayPanel({
  players,
  currentPlayerId,
  localTarget,
  maxTarget,
  turnDarts,
  isProcessing,
  onDartThrown,
}: AroundTheClockPlayPanelProps) {
  return (
    <>
      <View className="items-center mb-8">
        <Text className="text-sm font-barlow text-ds-on-surface-variant mb-1">Target</Text>
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE_DENSE} className="text-7xl font-barlow-bold text-ds-on-surface">
          {localTarget > maxTarget ? '\u2713' : getTargetLabel(localTarget)}
        </Text>
        {localTarget <= maxTarget && (
          <Text className="text-sm text-ds-outline mt-1">
            {localTarget} of {maxTarget}
          </Text>
        )}
      </View>

      <AroundTheClockInput
        currentTarget={localTarget}
        dartIndex={turnDarts.length}
        thrownDarts={turnDarts}
        onDartThrown={onDartThrown}
        disabled={isProcessing || localTarget > maxTarget}
      />

      <View className="mt-8">
        <Text className="text-sm font-barlow-semi text-ds-on-surface-variant mb-3 uppercase tracking-wide">
          Scoreboard
        </Text>
        {players.map((player) => {
          const atcState = player.gameState as AroundTheClockPlayerState;
          const isCurrent = player.id === currentPlayerId;
          const playerTarget =
            isCurrent && localTarget !== atcState.currentTarget
              ? localTarget
              : atcState.currentTarget;
          const isFinished = playerTarget > maxTarget;

          return (
            <View
              key={player.id}
              className={`flex-row items-center py-3 px-3 rounded-lg mb-1 ${
                isCurrent ? 'bg-ds-surface-low' : ''
              }`}
            >
              <View
                className="w-6 h-6 rounded-full mr-3"
                style={{ backgroundColor: player.avatarColor }}
              />
              <Text
                className={`flex-1 text-base ${
                  isCurrent ? 'font-barlow-semi text-ds-on-surface' : 'font-barlow text-ds-on-surface-variant'
                }`}
              >
                {player.name}
              </Text>
              <Text
                className={`text-sm ${
                  isFinished ? 'text-ds-green-dark font-barlow-bold' : 'text-ds-on-surface-variant'
                }`}
              >
                {isFinished ? 'Done!' : `${playerTarget - 1}/${maxTarget}`}
              </Text>
            </View>
          );
        })}
      </View>
    </>
  );
}
