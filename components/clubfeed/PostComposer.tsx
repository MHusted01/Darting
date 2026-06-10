import { useState } from 'react';
import { DS_COLORS } from '@/constants/colors';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { X } from 'lucide-react-native';
import { useAuth } from '@clerk/expo';
import { useClubMembers } from '@/hooks/useClubs';
import { useCreatePost } from '@/hooks/useClubFeed';
import { usePlayerRecentGames } from '@/hooks/useFriendSocial';
import { getActiveMentionQuery, insertMention } from '@/lib/mentions';
import type { ClubMember, RecentGame } from '@/types/social';

interface Props {
  visible: boolean;
  clubId: string;
  onClose: () => void;
}

function memberDisplayName(m: ClubMember): string {
  return [m.firstName, m.lastName].filter(Boolean).join(' ') || m.username || '';
}

export function PostComposer({ visible, clubId, onClose }: Props) {
  const [body, setBody] = useState('');
  const [attachedGame, setAttachedGame] = useState<RecentGame | null>(null);
  const { userId } = useAuth();
  const createPost = useCreatePost(clubId);
  const { data: recentGamesRaw } = usePlayerRecentGames(userId ?? '');
  const { data: members } = useClubMembers(clubId);
  const recentGames = Array.isArray(recentGamesRaw) ? recentGamesRaw.slice(0, 5) : [];

  const mentionQuery = getActiveMentionQuery(body);
  const mentionSuggestions: ClubMember[] =
    mentionQuery !== null && Array.isArray(members)
      ? members.filter((m) => {
          if (!m.username || m.id === userId) return false;
          if (mentionQuery === '') return true;
          const q = mentionQuery.toLowerCase();
          return (
            m.username.toLowerCase().startsWith(q) ||
            m.firstName?.toLowerCase().startsWith(q) ||
            m.lastName?.toLowerCase().startsWith(q)
          );
        })
      : [];

  function handleMentionSelect(member: ClubMember) {
    if (!member.username) return;
    setBody((prev) => insertMention(prev, member.username!));
  }

  function handleClose() {
    setBody('');
    setAttachedGame(null);
    onClose();
  }

  function handleSubmit() {
    if (!body.trim()) {
      Alert.alert('Write something', 'Your post needs some text.');
      return;
    }
    createPost.mutate(
      { body: body.trim(), gameSessionId: attachedGame?.id ?? null },
      {
        onSuccess: handleClose,
        onError: (err) => Alert.alert('Error', err.message),
      },
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        className="flex-1 bg-ds-bg"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View className="flex-row items-center justify-between px-6 pt-6 pb-4 border-b border-ds-outline-variant">
          <Text className="text-xl font-barlow-condensed text-ds-on-surface">New Post</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close composer"
            onPress={handleClose}
            className="active:opacity-70"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X size={22} color={DS_COLORS.onSurfaceVariant} />
          </Pressable>
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, gap: 16 }}>
          <View>
            <View className="bg-ds-surface border border-ds-outline-variant rounded-xl px-4 pt-3 pb-2">
              <TextInput
                accessibilityLabel="Post body"
                className="text-base font-barlow text-ds-on-surface min-h-24"
                placeholder="What's on your mind? Type @ to mention a member."
                placeholderTextColor={DS_COLORS.outline}
                value={body}
                onChangeText={setBody}
                multiline
                maxLength={1000}
                textAlignVertical="top"
              />
            </View>

            {mentionSuggestions.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                className="mt-2"
                contentContainerStyle={{ gap: 8, paddingHorizontal: 2 }}
              >
                {mentionSuggestions.map((member) => (
                  <Pressable
                    key={member.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Mention ${memberDisplayName(member)}`}
                    onPress={() => handleMentionSelect(member)}
                    className="bg-ds-surface border border-ds-outline-variant rounded-full px-3 py-2 active:opacity-70 flex-row items-center gap-2"
                  >
                    <View className="w-6 h-6 rounded-full bg-ds-surface-container items-center justify-center">
                      <Text className="text-xs font-barlow-semi text-ds-on-surface-variant">
                        {(member.firstName?.[0] ?? member.username?.[0] ?? '?').toUpperCase()}
                      </Text>
                    </View>
                    <View>
                      <Text className="text-sm font-barlow-semi text-ds-on-surface">
                        {memberDisplayName(member)}
                      </Text>
                      {member.username && (
                        <Text className="text-xs font-barlow text-ds-outline">
                          @{member.username}
                        </Text>
                      )}
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>

          {recentGames && recentGames.length > 0 && (
            <View>
              <Text className="text-xs font-barlow-semi text-ds-on-surface-variant uppercase tracking-widest mb-2">
                Attach a recent game
              </Text>
              {recentGames.map((game) => {
                const selected = attachedGame?.id === game.id;
                return (
                  <Pressable
                    key={game.id}
                    accessibilityRole="checkbox"
                    accessibilityLabel={`Attach ${game.gameSlug} game`}
                    accessibilityState={{ checked: selected }}
                    onPress={() => setAttachedGame(selected ? null : game)}
                    className={`flex-row items-center justify-between px-4 py-3 rounded-xl mb-2 border active:opacity-70 ${
                      selected ? 'bg-ds-red-container border-ds-red' : 'bg-ds-surface border-ds-outline-variant'
                    }`}
                  >
                    <Text className={`text-sm font-barlow-semi ${selected ? 'text-ds-red' : 'text-ds-on-surface'}`}>
                      {game.gameSlug}
                      {game.isWinner ? ' · Won' : ''}
                    </Text>
                    {game.threeDartAvg != null && (
                      <Text className="text-xs font-barlow text-ds-on-surface-variant">
                        {game.threeDartAvg.toFixed(1)} avg
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
          )}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Post"
            onPress={handleSubmit}
            disabled={!body.trim() || createPost.isPending}
            className={`rounded-xl py-4 items-center active:opacity-70 ${body.trim() ? 'bg-ds-red' : 'bg-ds-surface-container'} ${createPost.isPending ? 'opacity-50' : ''}`}
          >
            {createPost.isPending ? (
              <ActivityIndicator size="small" color={DS_COLORS.onRed} />
            ) : (
              <Text className={`text-base font-barlow-semi ${body.trim() ? 'text-ds-on-red' : 'text-ds-outline'}`}>
                Post
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
