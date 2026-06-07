import { View, Text, ScrollView, Pressable } from 'react-native';
import { useAuth } from '@clerk/expo';
import { useClubMembers } from '@/hooks/useClubs';
import { getDisplayName } from '@/lib/contact-display';
import type { ContactPlayer } from '@/types/social';

interface ClubMembersSectionProps {
  clubId: string;
  clubName: string;
  addedContactUserIds: ReadonlySet<string>;
  onAdd: (contact: ContactPlayer) => void;
}

export function ClubMembersSection({
  clubId,
  clubName,
  addedContactUserIds,
  onAdd,
}: ClubMembersSectionProps) {
  const { userId } = useAuth();
  const { data: members } = useClubMembers(clubId);

  if (!members) return null;

  const others = members.filter((m) => m.id !== userId);
  if (others.length === 0) return null;

  return (
    <View className="mb-3">
      <Text className="text-xs font-barlow-semi text-ds-outline mb-2">{clubName}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
      >
        {others.map((member) => {
          const displayName = getDisplayName(member.firstName, member.username);
          const added = addedContactUserIds.has(member.id);
          return (
            <Pressable
              key={member.id}
              onPress={() => {
                if (added) return;
                onAdd({ userId: member.id, displayName, username: member.username });
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
    </View>
  );
}
