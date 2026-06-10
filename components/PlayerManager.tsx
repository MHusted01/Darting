import { AVATAR_COLORS as PALETTE } from '@/constants/avatarColors';
import { useState } from 'react';
import { DS_COLORS } from '@/constants/colors';
import { View, Text, TextInput, Pressable } from 'react-native';
import { X, UserPlus } from 'lucide-react-native';

export interface Player {
  id: number;
  name: string;
  avatarColor: string;
  userId?: string;
}

interface PlayerManagerProps {
  players: Player[];
  onAddPlayer?: (name: string) => void;
  onRemovePlayer: (playerId: number) => void;
  minPlayers?: number;
  lockedPlayerId?: number;
  lockedPlayerIds?: ReadonlySet<number>;
}

export { AVATAR_COLORS } from '@/constants/avatarColors';

export function getNextAvatarColor(currentCount: number): string {
  return PALETTE[currentCount % PALETTE.length];
}

export function PlayerManager({
  players,
  onAddPlayer,
  onRemovePlayer,
  minPlayers = 1,
  lockedPlayerId,
  lockedPlayerIds,
}: PlayerManagerProps) {
  const [name, setName] = useState('');

  const handleAdd = () => {
    const trimmed = name.trim();
    if (!trimmed || !onAddPlayer) return;
    onAddPlayer(trimmed);
    setName('');
  };

  const canRemove = players.length > minPlayers;

  function isLocked(playerId: number): boolean {
    return playerId === lockedPlayerId || (lockedPlayerIds?.has(playerId) ?? false);
  }

  return (
    <View className="gap-4">
      <Text className="text-lg font-barlow-condensed text-ds-on-surface">Players</Text>

      {onAddPlayer != null && (
        <View className="flex-row gap-2">
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Add guest player"
            placeholderTextColor={DS_COLORS.outline}
            onSubmitEditing={handleAdd}
            returnKeyType="done"
            className="flex-1 bg-ds-surface border border-ds-outline-variant rounded-xl px-4 py-3 text-base font-barlow text-ds-on-surface"
            accessibilityLabel="Enter player name"
          />
          <Pressable
            onPress={handleAdd}
            disabled={!name.trim()}
            className={`items-center justify-center rounded-xl px-4 ${
              name.trim() ? 'bg-ds-red active:opacity-70' : 'bg-ds-surface-container'
            }`}
            accessibilityRole="button"
            accessibilityLabel="Add player"
          >
            <UserPlus size={20} color={name.trim() ? DS_COLORS.onRed : DS_COLORS.outline} />
          </Pressable>
        </View>
      )}

      {players.length > 0 && (
        <View className="bg-ds-surface border border-ds-outline-variant rounded-xl overflow-hidden">
          {players.map((player, idx) => (
            <View
              key={player.id}
              className={`flex-row items-center px-4 py-3${idx < players.length - 1 ? ' border-b border-ds-outline-variant' : ''}`}
            >
              <View
                className="w-8 h-8 rounded-full items-center justify-center mr-3"
                style={{ backgroundColor: player.avatarColor }}
              >
                <Text className="text-ds-on-red text-sm font-barlow-semi">
                  {player.name.charAt(0).toUpperCase()}
                </Text>
              </View>

              <Text className="flex-1 text-base font-barlow text-ds-on-surface">{player.name}</Text>

              {isLocked(player.id) && (
                <Text className="text-xs font-barlow-semi text-ds-red mr-2">
                  {player.id === lockedPlayerId ? 'You' : 'Locked'}
                </Text>
              )}

              {canRemove && !isLocked(player.id) && (
                <Pressable
                  onPress={() => onRemovePlayer(player.id)}
                  className="p-1 active:opacity-70"
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${player.name}`}
                >
                  <X size={18} color={DS_COLORS.outline} />
                </Pressable>
              )}
            </View>
          ))}
        </View>
      )}

      {players.length === 0 && (
        <Text className="text-sm font-barlow text-ds-outline text-center py-4">
          Add at least {minPlayers} player to start
        </Text>
      )}
    </View>
  );
}
