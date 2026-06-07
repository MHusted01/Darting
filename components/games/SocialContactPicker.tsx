import { View, Text, ScrollView, Pressable } from 'react-native';
import { ClubMembersSection } from '@/components/games/ClubMembersSection';
import { getDisplayName } from '@/lib/contact-display';
import type { Friend, Club, ContactPlayer } from '@/types/social';

export type { ContactPlayer };

interface SocialContactPickerProps {
  friends: Friend[];
  clubs: Club[];
  addedContactUserIds: ReadonlySet<string>;
  onAdd: (contact: ContactPlayer) => void;
}

export function SocialContactPicker({
  friends,
  clubs,
  addedContactUserIds,
  onAdd,
}: SocialContactPickerProps) {
  if (friends.length === 0 && clubs.length === 0) return null;

  return (
    <View className="mb-4">
      <Text className="text-xs font-barlow-semi text-ds-on-surface-variant uppercase tracking-widest mb-3">
        From Your Network
      </Text>

      {friends.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
          className="mb-3"
        >
          {friends.map((friend) => {
            const displayName = getDisplayName(friend.firstName, friend.username);
            const added = addedContactUserIds.has(friend.id);
            return (
              <Pressable
                key={friend.id}
                onPress={() => {
                  if (added) return;
                  onAdd({ userId: friend.id, displayName, username: friend.username });
                }}
                disabled={added}
                accessibilityRole="button"
                accessibilityLabel={`Add ${displayName}`}
                accessibilityState={{ disabled: added }}
                className={`items-center gap-1 ${added ? 'opacity-50' : 'active:opacity-70'}`}
              >
                <View className="w-11 h-11 rounded-full bg-ds-surface-low border border-ds-outline-variant items-center justify-center">
                  <Text className="text-sm font-barlow-semi text-ds-on-surface">
                    {displayName.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text
                  className="text-xs font-barlow text-ds-on-surface-variant max-w-[60px]"
                  numberOfLines={1}
                >
                  {displayName}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {clubs.map((club) => (
        <ClubMembersSection
          key={club.id}
          clubId={club.id}
          clubName={club.name}
          addedContactUserIds={addedContactUserIds}
          onAdd={onAdd}
        />
      ))}
    </View>
  );
}
