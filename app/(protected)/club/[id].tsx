import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Crown, LogOut, UserPlus } from 'lucide-react-native';
import { useClubLeaderboard, useClubMembers, useInviteMember, useLeaveClub, useMyClubs } from '@/hooks/useClubs';
import { useUserSearch } from '@/hooks/useFriends';
import type { ClubLeaderboardRow, ClubMember, UserProfile } from '@/types/social';

type Tab = 'members' | 'leaderboard';

// ─── Invite modal ─────────────────────────────────────────────────────────────

interface InviteModalProps {
  clubId: string;
  visible: boolean;
  onClose: () => void;
}

function displayName(user: UserProfile | ClubMember): string {
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Unknown';
}

function initials(user: UserProfile | ClubMember): string {
  const first = user.firstName?.[0] ?? '';
  const last  = user.lastName?.[0] ?? '';
  return (first + last).toUpperCase() || '?';
}

function InviteModal({ clubId, visible, onClose }: InviteModalProps) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const { data: results, isFetching } = useUserSearch(debouncedQuery);
  const inviteMember = useInviteMember(clubId);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 400);
    return () => clearTimeout(timer);
  }, [query]);

  function handleInvite(user: UserProfile) {
    inviteMember.mutate(user.id, {
      onSuccess: () => Alert.alert('Invited', `Invite sent to ${displayName(user)}.`),
      onError:   (err) => Alert.alert('Error', err.message),
    });
  }

  function handleClose() {
    setQuery('');
    setDebouncedQuery('');
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View className="flex-1 bg-ds-bg">
        <View className="flex-row items-center justify-between px-6 pt-6 pb-4 border-b border-ds-outline-variant">
          <Text className="text-xl font-barlow-condensed text-ds-on-surface">Invite Member</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={handleClose} className="active:opacity-70"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text className="text-sm font-barlow-semi text-ds-on-surface-variant">Cancel</Text>
          </Pressable>
        </View>
        <View className="px-6 pt-4">
          <View className="bg-ds-surface border border-ds-outline-variant rounded-xl px-4 flex-row items-center">
            <TextInput
              className="flex-1 py-4 text-base font-barlow text-ds-on-surface"
              placeholder="Search by name or email"
              placeholderTextColor="#747878"
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {isFetching && <ActivityIndicator size="small" color="#747878" />}
          </View>
        </View>
        {results && results.length > 0 && (
          <View className="px-6 pt-4">
            <View className="bg-ds-surface border border-ds-outline-variant rounded-xl overflow-hidden">
              {results.map((user, index) => (
                <View key={user.id} className={`px-4 py-3 flex-row items-center gap-3 ${index < results.length - 1 ? 'border-b border-ds-outline-variant' : ''}`}>
                  <View className="w-10 h-10 rounded-full bg-ds-surface-low items-center justify-center">
                    <Text className="text-sm font-barlow-semi text-ds-on-surface-variant">{initials(user)}</Text>
                  </View>
                  <Text className="flex-1 text-sm font-barlow-semi text-ds-on-surface">{displayName(user)}</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Invite ${displayName(user)}`}
                    className="bg-ds-red rounded-lg px-3 py-2 active:opacity-70"
                    onPress={() => handleInvite(user)}
                    disabled={inviteMember.isPending}
                  >
                    <Text className="text-xs font-barlow-semi text-white">Invite</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

// ─── Member row ───────────────────────────────────────────────────────────────

function MemberRow({ member, isLast }: { member: ClubMember; isLast: boolean }) {
  return (
    <View className={`px-4 py-3 flex-row items-center gap-3 ${isLast ? '' : 'border-b border-ds-outline-variant'}`}>
      <View className="w-10 h-10 rounded-full bg-ds-surface-low items-center justify-center">
        <Text className="text-sm font-barlow-semi text-ds-on-surface-variant">{initials(member)}</Text>
      </View>
      <Text className="flex-1 text-sm font-barlow-semi text-ds-on-surface">{displayName(member)}</Text>
      {member.role === 'admin' && (
        <View className="flex-row items-center gap-1">
          <Crown size={14} color="#ba1a1a" />
          <Text className="text-xs font-barlow-semi text-ds-red">Admin</Text>
        </View>
      )}
    </View>
  );
}

// ─── Leaderboard row ──────────────────────────────────────────────────────────

function LeaderboardRow({ row, rank, isLast }: { row: ClubLeaderboardRow; rank: number; isLast: boolean }) {
  const name = [row.firstName, row.lastName].filter(Boolean).join(' ') || 'Unknown';
  const ini  = ((row.firstName?.[0] ?? '') + (row.lastName?.[0] ?? '')).toUpperCase() || '?';

  return (
    <View className={`px-4 py-3 flex-row items-center gap-3 ${isLast ? '' : 'border-b border-ds-outline-variant'}`}>
      <Text className={`w-6 text-sm font-barlow-bold text-center ${rank <= 3 ? 'text-ds-red' : 'text-ds-outline'}`}>
        {rank}
      </Text>
      <View className="w-10 h-10 rounded-full bg-ds-surface-low items-center justify-center">
        <Text className="text-sm font-barlow-semi text-ds-on-surface-variant">{ini}</Text>
      </View>
      <Text className="flex-1 text-sm font-barlow-semi text-ds-on-surface">{name}</Text>
      <View className="items-end">
        <Text className="text-xs font-barlow-semi text-ds-on-surface-variant uppercase tracking-wide">Avg</Text>
        <Text className="text-lg font-barlow-bold text-ds-on-surface">
          {row.avgThreeDartAvg != null ? row.avgThreeDartAvg.toFixed(1) : '—'}
        </Text>
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ClubDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('members');
  const [inviteVisible, setInviteVisible] = useState(false);

  const { data: myClubs } = useMyClubs();
  const { data: members, isLoading: membersLoading } = useClubMembers(id);
  const { data: leaderboard, isLoading: leaderboardLoading } = useClubLeaderboard(id);
  const leaveClub = useLeaveClub();

  const myMembership = myClubs?.find((c) => c.id === id);
  const isAdmin = myMembership?.role === 'admin';
  const clubName = myMembership?.name ?? 'Club';

  function handleLeave() {
    Alert.alert('Leave Club', `Are you sure you want to leave ${clubName}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: () => {
          leaveClub.mutate(id, {
            onSuccess: () => router.back(),
            onError:   (err) => Alert.alert('Error', err.message),
          });
        },
      },
    ]);
  }

  return (
    <SafeAreaView className="flex-1 bg-ds-bg" edges={['top']}>
      <View className="flex-row items-center gap-3 px-6 pt-4 pb-3 border-b border-ds-outline-variant">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          className="active:opacity-70"
        >
          <ArrowLeft size={22} color="#1c1b1b" />
        </Pressable>
        <Text className="flex-1 text-xl font-barlow-condensed text-ds-on-surface">{clubName}</Text>

        {isAdmin && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Invite member"
            onPress={() => setInviteVisible(true)}
            className="active:opacity-70"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <UserPlus size={20} color="#444748" />
          </Pressable>
        )}

        {myMembership && !isAdmin && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Leave club"
            onPress={handleLeave}
            className="active:opacity-70"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <LogOut size={20} color="#ba1a1a" />
          </Pressable>
        )}
      </View>

      {/* Tab strip */}
      <View className="flex-row border-b border-ds-outline-variant">
        {(['members', 'leaderboard'] as Tab[]).map((tab) => (
          <Pressable
            key={tab}
            onPress={() => setActiveTab(tab)}
            className={`flex-1 py-3 items-center active:opacity-70 ${
              activeTab === tab ? 'border-b-2 border-ds-red' : ''
            }`}
          >
            <Text className={`text-sm font-barlow-semi capitalize ${
              activeTab === tab ? 'text-ds-red' : 'text-ds-on-surface-variant'
            }`}>
              {tab}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        {activeTab === 'members' && (
          <View className="px-6 pt-4">
            {membersLoading ? (
              <ActivityIndicator size="small" color="#ba1a1a" />
            ) : !members || members.length === 0 ? (
              <Text className="text-sm font-barlow text-ds-outline text-center py-8">No members yet.</Text>
            ) : (
              <View className="bg-ds-surface border border-ds-outline-variant rounded-xl overflow-hidden">
                {members.map((member, index) => (
                  <MemberRow key={member.membershipId} member={member} isLast={index === members.length - 1} />
                ))}
              </View>
            )}
          </View>
        )}

        {activeTab === 'leaderboard' && (
          <View className="px-6 pt-4">
            {leaderboardLoading ? (
              <ActivityIndicator size="small" color="#ba1a1a" />
            ) : !leaderboard || leaderboard.length === 0 ? (
              <Text className="text-sm font-barlow text-ds-outline text-center py-8">
                No stats yet. Complete some games to appear here.
              </Text>
            ) : (
              <View className="bg-ds-surface border border-ds-outline-variant rounded-xl overflow-hidden">
                {leaderboard.map((row, index) => (
                  <LeaderboardRow key={row.userId} row={row} rank={index + 1} isLast={index === leaderboard.length - 1} />
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      <InviteModal clubId={id} visible={inviteVisible} onClose={() => setInviteVisible(false)} />
    </SafeAreaView>
  );
}
