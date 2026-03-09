import { View, Text } from 'react-native';
import { CricketInput } from '@/components/games/CricketInput';
import { CricketScoreboard } from '@/components/games/CricketScoreboard';
import type { CricketPlayerState } from '@/lib/games/cricket';
import type { DartThrow } from '@/types/game';

interface CricketPanelPlayer {
  name: string;
  avatarColor: string;
  gameState: unknown;
}

interface CricketPlayPanelProps {
  players: CricketPanelPlayer[];
  currentPlayerIndex: number;
  localCricketState: CricketPlayerState;
  turnDarts: DartThrow[];
  isProcessing: boolean;
  onDartThrown: (dart: DartThrow) => void | Promise<void>;
}

export function CricketPlayPanel({
  players,
  currentPlayerIndex,
  localCricketState,
  turnDarts,
  isProcessing,
  onDartThrown,
}: CricketPlayPanelProps) {
  return (
    <>
      <View className="items-center mb-6">
        <Text className="text-sm text-gray-500 mb-1">Points</Text>
        <Text className="text-5xl font-bold text-black">
          {localCricketState.points}
        </Text>
      </View>

      <CricketInput
        dartIndex={turnDarts.length}
        thrownDarts={turnDarts}
        onDartThrown={onDartThrown}
        disabled={isProcessing}
      />

      <CricketScoreboard
        players={players.map((player, index) => {
          const isCurrent = index === currentPlayerIndex;
          const state = isCurrent
            ? localCricketState
            : (player.gameState as CricketPlayerState);
          return {
            name: player.name,
            avatarColor: player.avatarColor,
            marks: state.marks,
            points: state.points,
            isCurrent,
          };
        })}
        currentPlayerIndex={currentPlayerIndex}
      />
    </>
  );
}
