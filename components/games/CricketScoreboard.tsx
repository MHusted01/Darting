import { View, Text, ScrollView } from 'react-native';
import {
  getSegmentLabel,
  type SegmentMarks,
} from '@/lib/games/cricket';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CricketScoreboardPlayer {
  name: string;
  avatarColor: string;
  marks: SegmentMarks;
  points: number;
  isCurrent: boolean;
}

interface CricketScoreboardProps {
  players: CricketScoreboardPlayer[];
  currentPlayerIndex: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Traditional Cricket mark display: /, X, circled */
function MarkSymbol({ count }: { count: number }) {
  if (count === 0) {
    return <View className="h-6" />;
  }
  if (count === 1) {
    return <Text className="text-black text-base font-bold text-center">/</Text>;
  }
  if (count === 2) {
    return <Text className="text-black text-base font-bold text-center">X</Text>;
  }
  // 3+ marks = closed
  return (
    <View className="w-6 h-6 rounded-full border-2 border-emerald-500 items-center justify-center self-center">
      <Text className="text-emerald-600 text-xs font-bold">X</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

// Display segments in traditional order: 20 down to 15, then Bull
const DISPLAY_ORDER = [20, 19, 18, 17, 16, 15, 25] as const;
const HEADER_ROW_HEIGHT = 64;
const SEGMENT_ROW_HEIGHT = 44;
const FOOTER_ROW_HEIGHT = 40;

export function CricketScoreboard({
  players,
  currentPlayerIndex,
}: CricketScoreboardProps) {
  return (
    <View className="mt-8">
      <Text className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wide">
        Scoreboard
      </Text>

      <View className="border border-gray-200 rounded-xl overflow-hidden">
        <View className="flex-row">
          {/* Fixed left segment column */}
          <View className="w-14 border-r border-gray-200">
            <View
              className="px-2 justify-center bg-gray-50 border-b border-gray-200"
              style={{ height: HEADER_ROW_HEIGHT }}
            >
              <Text className="text-xs text-gray-400 font-semibold">Seg</Text>
            </View>
            {DISPLAY_ORDER.map((segment, rowIdx) => (
              <View
                key={segment}
                className={`px-2 justify-center ${
                  rowIdx < DISPLAY_ORDER.length - 1 ? 'border-b border-gray-100' : ''
                }`}
                style={{ height: SEGMENT_ROW_HEIGHT }}
              >
                <Text className="text-sm font-bold text-black">
                  {getSegmentLabel(segment)}
                </Text>
              </View>
            ))}
            <View
              className="px-2 justify-center bg-gray-50 border-t border-gray-200"
              style={{ height: FOOTER_ROW_HEIGHT }}
            >
              <Text className="text-xs text-gray-400 font-semibold">Pts</Text>
            </View>
          </View>

          {/* Player columns (scroll for 3+ players) */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View>
              {/* Header row */}
              <View className="flex-row border-b border-gray-200 bg-gray-50">
                {players.map((player, idx) => (
                  <View
                    key={idx}
                    className={`w-20 px-1 items-center justify-center ${
                      player.isCurrent || idx === currentPlayerIndex ? 'bg-gray-100' : ''
                    }`}
                    style={{ height: HEADER_ROW_HEIGHT }}
                  >
                    <View
                      className="w-6 h-6 rounded-full items-center justify-center mb-1"
                      style={{ backgroundColor: player.avatarColor }}
                    >
                      <Text className="text-white text-xs font-bold">
                        {player.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <Text className="text-xs text-gray-600 text-center" numberOfLines={1}>
                      {player.name}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Segment rows */}
              {DISPLAY_ORDER.map((segment, rowIdx) => (
                <View
                  key={segment}
                  className={`flex-row ${
                    rowIdx < DISPLAY_ORDER.length - 1 ? 'border-b border-gray-100' : ''
                  }`}
                >
                  {players.map((player, idx) => {
                    const markCount = player.marks[segment] ?? 0;

                    return (
                      <View
                        key={idx}
                        className={`w-20 px-1 items-center justify-center ${
                          player.isCurrent || idx === currentPlayerIndex ? 'bg-gray-50' : ''
                        }`}
                        style={{ height: SEGMENT_ROW_HEIGHT }}
                      >
                        <MarkSymbol count={markCount} />
                      </View>
                    );
                  })}
                </View>
              ))}

              {/* Points footer */}
              <View className="flex-row border-t border-gray-200 bg-gray-50">
                {players.map((player, idx) => (
                  <View
                    key={idx}
                    className={`w-20 px-1 items-center justify-center ${
                      player.isCurrent || idx === currentPlayerIndex ? 'bg-gray-100' : ''
                    }`}
                    style={{ height: FOOTER_ROW_HEIGHT }}
                  >
                    <Text className="text-sm font-bold text-black">{player.points}</Text>
                  </View>
                ))}
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </View>
  );
}
