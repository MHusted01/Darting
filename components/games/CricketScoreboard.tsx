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

/**
 * Render a visual mark for a cricket segment based on the provided count.
 *
 * Displays:
 * - 0: empty spacer
 * - 1: `/`
 * - 2: `X`
 * - 3 or more: circular badge with `X`
 *
 * @param count - Number of marks recorded for the segment
 * @returns A React element representing the mark for `count`
 */
function MarkSymbol({ count }: { count: number }) {
  if (count === 0) {
    return <View className="h-6" />;
  }
  if (count === 1) {
    return <Text className="text-ds-on-surface text-base font-barlow-bold text-center">/</Text>;
  }
  if (count === 2) {
    return <Text className="text-ds-on-surface text-base font-barlow-bold text-center">X</Text>;
  }
  // 3+ marks = closed
  return (
    <View className="w-6 h-6 rounded-full border-2 border-ds-green-dark items-center justify-center self-center">
      <Text className="text-ds-green-dark text-xs font-barlow-bold">X</Text>
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

/**
 * Render a cricket-style scoreboard with a fixed left column of segments and horizontally scrollable player columns.
 *
 * Displays segment labels (20–15 and Bull) in a fixed left column, and for each player shows an avatar, name,
 * per-segment mark symbols, and total points. The column for the current player (determined by `player.isCurrent`
 * or `currentPlayerIndex`) is visually highlighted.
 *
 * @param players - Array of player entries containing name, avatarColor, marks, points, and optional isCurrent flag
 * @param currentPlayerIndex - Index of the current player to highlight when `isCurrent` is not set on players
 * @returns A JSX element representing the scoreboard layout
 */
export function CricketScoreboard({
  players,
  currentPlayerIndex,
}: CricketScoreboardProps) {
  return (
    <View className="mt-8">
      <Text className="text-sm font-barlow-semi text-ds-on-surface-variant mb-3 uppercase tracking-wide">
        Scoreboard
      </Text>

      <View className="border border-ds-outline-variant rounded-xl overflow-hidden">
        <View className="flex-row">
          {/* Fixed left segment column */}
          <View className="w-14 border-r border-ds-outline-variant">
            <View
              className="px-2 justify-center bg-ds-surface-low border-b border-ds-outline-variant"
              style={{ height: HEADER_ROW_HEIGHT }}
            >
              <Text className="text-xs text-ds-outline font-barlow-semi">Seg</Text>
            </View>
            {DISPLAY_ORDER.map((segment, rowIdx) => (
              <View
                key={segment}
                className={`px-2 justify-center ${
                  rowIdx < DISPLAY_ORDER.length - 1 ? 'border-b border-ds-outline-variant' : ''
                }`}
                style={{ height: SEGMENT_ROW_HEIGHT }}
              >
                <Text className="text-sm font-barlow-bold text-ds-on-surface">
                  {getSegmentLabel(segment)}
                </Text>
              </View>
            ))}
            <View
              className="px-2 justify-center bg-ds-surface-low border-t border-ds-outline-variant"
              style={{ height: FOOTER_ROW_HEIGHT }}
            >
              <Text className="text-xs text-ds-outline font-barlow-semi">Pts</Text>
            </View>
          </View>

          {/* Player columns (scroll for 3+ players) */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View>
              {/* Header row */}
              <View className="flex-row border-b border-ds-outline-variant bg-ds-surface-low">
                {players.map((player, idx) => (
                  <View
                    key={idx}
                    className={`w-20 px-1 items-center justify-center ${
                      player.isCurrent || idx === currentPlayerIndex ? 'bg-ds-surface-low' : ''
                    }`}
                    style={{ height: HEADER_ROW_HEIGHT }}
                  >
                    <View
                      className="w-6 h-6 rounded-full items-center justify-center mb-1"
                      style={{ backgroundColor: player.avatarColor }}
                    >
                      <Text className="text-white text-xs font-barlow-bold">
                        {player.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <Text className="text-xs text-ds-on-surface-variant text-center" numberOfLines={1}>
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
                    rowIdx < DISPLAY_ORDER.length - 1 ? 'border-b border-ds-outline-variant' : ''
                  }`}
                >
                  {players.map((player, idx) => {
                    const markCount = player.marks[segment] ?? 0;

                    return (
                      <View
                        key={idx}
                        className={`w-20 px-1 items-center justify-center ${
                          player.isCurrent || idx === currentPlayerIndex ? 'bg-ds-surface-low' : ''
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
              <View className="flex-row border-t border-ds-outline-variant bg-ds-surface-low">
                {players.map((player, idx) => (
                  <View
                    key={idx}
                    className={`w-20 px-1 items-center justify-center ${
                      player.isCurrent || idx === currentPlayerIndex ? 'bg-ds-surface-low' : ''
                    }`}
                    style={{ height: FOOTER_ROW_HEIGHT }}
                  >
                    <Text className="text-sm font-barlow-bold text-ds-on-surface">{player.points}</Text>
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
