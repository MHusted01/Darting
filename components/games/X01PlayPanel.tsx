import { View, Text } from 'react-native';
import { X01Input } from './X01Input';
import type { LoadedPlayer } from '@/hooks/usePlaySession';
import type { X01PlayerState } from '@/lib/games/x01';
import type { DartThrow } from '@/types/game';

interface X01PlayPanelProps {
  players: LoadedPlayer[];
  currentPlayerId: number;
  localX01State: X01PlayerState;
  turnDarts: DartThrow[];
  isProcessing: boolean;
  onDartThrown: (dart: DartThrow) => void;
}

function DartSlots({ darts }: { darts: DartThrow[] }) {
  const slots = Array.from({ length: 3 }, (_, i) => darts[i] ?? null);

  return (
    <View className="flex-row justify-center gap-3 mb-5">
      {slots.map((dart, i) => {
        let label = '—';
        if (dart) {
          if (dart.segment === 0) {
            label = 'Miss';
          } else if (dart.multiplier === 2 && dart.segment === 25) {
            label = 'D-Bull';
          } else if (dart.segment === 25) {
            label = 'Bull';
          } else {
            const prefix = dart.multiplier === 2 ? 'D' : dart.multiplier === 3 ? 'T' : '';
            label = `${prefix}${dart.segment}`;
          }
        }
        const score =
          dart && dart.segment > 0 ? dart.segment * dart.multiplier : null;

        return (
          <View
            key={i}
            className={`flex-1 rounded-xl py-2.5 items-center border ${
              dart
                ? 'bg-ds-surface border-ds-outline-variant'
                : 'bg-ds-surface-low border-ds-outline-variant'
            }`}
          >
            <Text
              className={`text-sm font-barlow-semi ${dart ? 'text-ds-on-surface' : 'text-ds-outline'}`}
            >
              {label}
            </Text>
            {score !== null && (
              <Text className="text-xs font-barlow text-ds-on-surface-variant mt-0.5">
                {score}
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

function PlayerRow({
  player,
  isCurrent,
  liveRemaining,
}: {
  player: LoadedPlayer;
  isCurrent: boolean;
  liveRemaining?: number;
}) {
  const state = player.gameState as X01PlayerState;
  const displayRemaining =
    isCurrent && liveRemaining !== undefined
      ? liveRemaining
      : (state?.remaining ?? '—');

  return (
    <View
      className={`flex-row items-center px-4 py-3 border-b border-ds-outline-variant ${
        isCurrent ? 'bg-ds-surface-container' : ''
      }`}
    >
      <View
        className="w-8 h-8 rounded-full items-center justify-center mr-3"
        style={{ backgroundColor: player.avatarColor }}
      >
        <Text className="text-white text-xs font-barlow-semi">
          {player.name.charAt(0).toUpperCase()}
        </Text>
      </View>
      <Text
        className={`flex-1 text-sm ${isCurrent ? 'font-barlow-semi text-ds-on-surface' : 'font-barlow text-ds-on-surface-variant'}`}
      >
        {player.name}
      </Text>
      <Text
        className={`text-lg ${isCurrent ? 'font-barlow-bold text-ds-on-surface' : 'font-barlow text-ds-on-surface-variant'}`}
      >
        {displayRemaining}
      </Text>
    </View>
  );
}

export function X01PlayPanel({
  players,
  currentPlayerId,
  localX01State,
  turnDarts,
  isProcessing,
  onDartThrown,
}: X01PlayPanelProps) {
  return (
    <View className="gap-5">
      {/* Big remaining score */}
      <View className="items-center">
        <Text className="text-7xl font-barlow-bold text-ds-on-surface leading-none">
          {localX01State.remaining}
        </Text>
        <Text className="text-sm font-barlow text-ds-on-surface-variant mt-1">
          remaining
        </Text>
      </View>

      {/* Dart slots */}
      <DartSlots darts={turnDarts} />

      {/* Scoreboard */}
      {players.length > 1 && (
        <View className="bg-ds-surface border border-ds-outline-variant rounded-xl overflow-hidden mb-1">
          {players.map((player) => (
            <PlayerRow
              key={player.id}
              player={player}
              isCurrent={player.id === currentPlayerId}
              liveRemaining={
                player.id === currentPlayerId
                  ? localX01State.remaining
                  : undefined
              }
            />
          ))}
        </View>
      )}

      {/* Input */}
      <X01Input onDartThrown={onDartThrown} isProcessing={isProcessing} />
    </View>
  );
}
