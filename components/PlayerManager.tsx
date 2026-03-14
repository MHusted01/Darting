import { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { X, UserPlus } from 'lucide-react-native';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Player {
  id: number;
  name: string;
  avatarColor: string;
}

interface PlayerManagerProps {
  players: Player[];
  onAddPlayer: (name: string) => void;
  onRemovePlayer: (playerId: number) => void;
  minPlayers?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const AVATAR_COLORS = [
  '#6366f1', // indigo
  '#10b981', // emerald
  '#f59e0b', // amber
  '#f43f5e', // rose
  '#0ea5e9', // sky
  '#f97316', // orange
  '#8b5cf6', // violet
  '#14b8a6', // teal
];

/** Pick a color from the palette based on how many players exist. */
export function getNextAvatarColor(currentCount: number): string {
  return AVATAR_COLORS[currentCount % AVATAR_COLORS.length];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PlayerManager({
  players,
  onAddPlayer,
  onRemovePlayer,
  minPlayers = 1,
}: PlayerManagerProps) {
  const [name, setName] = useState('');

  const handleAdd = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onAddPlayer(trimmed);
    setName('');
  };

  const canRemove = players.length > minPlayers;

  return (
    <View className="gap-4">
      <Text className="text-lg font-semibold text-black">Players</Text>

      {/* Add player input */}
      <View className="flex-row gap-2">
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Player name"
          placeholderTextColor="#9ca3af"
          onSubmitEditing={handleAdd}
          returnKeyType="done"
          className="flex-1 border border-gray-300 rounded-lg px-4 py-3 text-base text-black"
          accessibilityLabel="Enter player name"
        />
        <Pressable
          onPress={handleAdd}
          disabled={!name.trim()}
          className={`items-center justify-center rounded-lg px-4 ${
            name.trim() ? 'bg-black active:opacity-70' : 'bg-gray-200'
          }`}
          accessibilityRole="button"
          accessibilityLabel="Add player"
        >
          <UserPlus size={20} color={name.trim() ? 'white' : '#9ca3af'} />
        </Pressable>
      </View>

      {/* Player list */}
      {players.length > 0 && (
        <View className="gap-2">
          {players.map((player) => (
            <View
              key={player.id}
              className="flex-row items-center border border-gray-200 rounded-lg px-4 py-3"
            >
              {/* Avatar color dot */}
              <View
                className="w-8 h-8 rounded-full items-center justify-center mr-3"
                style={{ backgroundColor: player.avatarColor }}
              >
                <Text className="text-white text-sm font-bold">
                  {player.name.charAt(0).toUpperCase()}
                </Text>
              </View>

              {/* Name */}
              <Text className="flex-1 text-base text-black">{player.name}</Text>

              {/* Remove button */}
              {canRemove && (
                <Pressable
                  onPress={() => onRemovePlayer(player.id)}
                  className="p-1 active:opacity-70"
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${player.name}`}
                >
                  <X size={18} color="#9ca3af" />
                </Pressable>
              )}
            </View>
          ))}
        </View>
      )}

      {players.length === 0 && (
        <Text className="text-sm text-gray-400 text-center py-4">
          Add at least {minPlayers} player to start
        </Text>
      )}
    </View>
  );
}
