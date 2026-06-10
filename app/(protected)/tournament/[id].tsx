import { useState, useMemo } from 'react';
import { withErrorBoundary } from '@/components/ErrorBoundary';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Skeleton from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@clerk/expo';
import { ArrowLeft, Swords, UserPlus, Users } from 'lucide-react-native';
import {
  useTournamentDetail,
  useRegisterParticipant,
  useUnregisterParticipant,
  useStartTournament,
  useUpdateTournamentStatus,
} from '@/hooks/useTournament';
import { calculateStandings } from '@/lib/tournament';
import { BracketView } from '@/components/tournament/BracketView';
import { StandingsTable } from '@/components/tournament/StandingsTable';
import { WeeklyLeaderboard } from '@/components/tournament/WeeklyLeaderboard';
import { TournamentMatchCard } from '@/components/tournament/TournamentMatchCard';
import type { TournamentMatch } from '@/types/tournament';

type Tab = 'overview' | 'matches' | 'participants';

const FORMAT_LABEL: Record<string, string> = {
  league: 'League',
  cup: 'Knockout',
  weekly: 'Weekly',
  round_robin: 'Round Robin',
};

function TournamentScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId } = useAuth();
  const [tab, setTab] = useState<Tab>('overview');

  const { data: tournament, isLoading, error, refetch, isRefetching } = useTournamentDetail(id ?? '');
  const registerParticipant = useRegisterParticipant(id ?? '');
  const unregisterParticipant = useUnregisterParticipant(id ?? '');
  const startTournamentMutation = useStartTournament(id ?? '', tournament?.clubId ?? '');
  const updateStatus = useUpdateTournamentStatus(id ?? '', tournament?.clubId ?? '');

  const allMatches = useMemo(
    () => tournament?.rounds.flatMap(r => r.matches) ?? [],
    [tournament],
  );

  const standings = useMemo(
    () =>
      tournament && tournament.format !== 'cup'
        ? calculateStandings(allMatches, tournament.participants)
        : [],
    [tournament, allMatches],
  );

  const isAdmin = useMemo(() => {
    if (!tournament || !userId) return false;
    return tournament.createdBy === userId;
  }, [tournament, userId]);

  const isParticipant = useMemo(
    () => tournament?.participants.some(p => p.user.id === userId) ?? false,
    [tournament, userId],
  );

  function handlePlayMatch(match: TournamentMatch) {
    if (!tournament) return;
    const p1UserId = match.participant1?.user.id ?? '';
    const p2UserId = match.participant2?.user.id ?? '';
    const tmP1Id = match.participant1?.id ?? '';
    const tmP2Id = match.participant2?.id ?? '';
    router.push(
      `/game/${tournament.gameSlug}?tournamentMatchId=${match.id}&tmP1Id=${tmP1Id}&tmP2Id=${tmP2Id}&p1UserId=${p1UserId}&p2UserId=${p2UserId}`,
    );
  }

  function handleRegister() {
    if (!userId) return;
    registerParticipant.mutate(
      { userId },
      {
        onError: (err) => Alert.alert('Error', err.message),
      },
    );
  }

  function handleUnregister() {
    if (!userId) return;
    Alert.alert('Leave tournament?', 'You will be removed from the participant list.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: () => unregisterParticipant.mutate(userId, { onError: (err) => Alert.alert('Error', err.message) }),
      },
    ]);
  }

  function handleStart() {
    if (!tournament) return;
    if (tournament.participants.length < 2) {
      Alert.alert('Not enough players', 'At least 2 participants are required to start a tournament.');
      return;
    }
    Alert.alert(
      'Start tournament?',
      `This will activate "${tournament.name}" and generate the first round. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start',
          onPress: () =>
            startTournamentMutation.mutate(
              { format: tournament.format, participants: tournament.participants },
              { onError: (err) => Alert.alert('Error', err.message) },
            ),
        },
      ],
    );
  }

  function handleCancel() {
    Alert.alert('Cancel tournament?', 'This will permanently cancel the tournament.', [
      { text: 'Back', style: 'cancel' },
      {
        text: 'Cancel Tournament',
        style: 'destructive',
        onPress: () =>
          updateStatus.mutate('cancelled', { onError: (err) => Alert.alert('Error', err.message) }),
      },
    ]);
  }

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-ds-bg" edges={['top']}>
        <View className="px-6 pt-6 gap-3" accessible accessibilityState={{ busy: true }} accessibilityLabel="Loading tournament">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !tournament) {
    return (
      <SafeAreaView className="flex-1 bg-ds-bg justify-center items-center px-6">
        <Text className="text-base font-barlow text-ds-on-surface-variant text-center mb-4">
          Could not load tournament.
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} className="bg-ds-red rounded-xl px-5 py-3 active:opacity-70">
          <Text className="text-white font-barlow-semi">Back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'overview', label: tournament.format === 'cup' ? 'Bracket' : 'Standings' },
    { key: 'matches', label: 'Matches' },
    { key: 'participants', label: `Players (${tournament.participantCount})` },
  ];

  return (
    <SafeAreaView className="flex-1 bg-ds-bg" edges={['top']}>
      <View className="flex-row items-center gap-3 px-6 pt-4 pb-3 border-b border-ds-outline-variant">
        <Pressable onPress={() => router.back()} className="active:opacity-70" accessibilityRole="button" accessibilityLabel="Back">
          <ArrowLeft size={22} color="#1c1b1b" />
        </Pressable>
        <View className="flex-1">
          <Text className="text-xl font-barlow-condensed text-ds-on-surface" numberOfLines={1}>
            {tournament.name}
          </Text>
          <Text className="text-xs font-barlow text-ds-on-surface-variant">
            {FORMAT_LABEL[tournament.format] ?? tournament.format} • {tournament.gameSlug.toUpperCase()}
          </Text>
        </View>
        {isAdmin && tournament.status === 'draft' && (
          <Pressable
            onPress={handleStart}
            className="bg-ds-red rounded-lg px-3 py-2 active:opacity-70"
            accessibilityRole="button"
            accessibilityLabel="Start tournament"
          >
            <Text className="text-sm font-barlow-semi text-white">Start</Text>
          </Pressable>
        )}
      </View>

      <View className="flex-row px-6 pt-3 pb-0 gap-1">
        {TABS.map(t => (
          <Pressable
            key={t.key}
            onPress={() => setTab(t.key)}
            className="flex-1 items-center pb-3 active:opacity-70"
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === t.key }}
          >
            <Text className={`text-sm font-barlow-semi ${tab === t.key ? 'text-ds-red' : 'text-ds-on-surface-variant'}`}>
              {t.label}
            </Text>
            {tab === t.key && <View className="absolute bottom-0 h-0.5 w-full bg-ds-red rounded-full" />}
          </Pressable>
        ))}
      </View>
      <View className="h-px bg-ds-outline-variant" />

      {tab === 'overview' && (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingTop: 16, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor="#ba1a1a" />
          }
        >
          {tournament.format === 'cup' ? (
            <BracketView
              rounds={tournament.rounds}
              participantCount={tournament.participantCount}
              currentUserId={userId}
              onPlayMatch={handlePlayMatch}
            />
          ) : tournament.format === 'weekly' ? (
            <View className="px-6">
              <WeeklyLeaderboard participants={tournament.participants} matches={allMatches} />
            </View>
          ) : (
            <View className="px-6">
              <StandingsTable standings={standings} />
            </View>
          )}

          {tournament.status === 'active' && (
            <View className="px-6 mt-4">
              {allMatches.filter(m => m.status === 'pending').map(match => (
                <View key={match.id} className="mb-3">
                  <TournamentMatchCard
                    match={match}
                    currentUserId={userId}
                    onPlayPress={handlePlayMatch}
                  />
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {tab === 'matches' && (
        <FlatList
          data={allMatches}
          keyExtractor={m => m.id}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          onRefresh={() => void refetch()}
          refreshing={isRefetching}
          renderItem={({ item }) => (
            <TournamentMatchCard
              match={item}
              currentUserId={userId}
              onPlayPress={tournament.status === 'active' ? handlePlayMatch : undefined}
            />
          )}
          ListEmptyComponent={
            <EmptyState icon={Swords} title="No matches yet" message="Matches appear once the tournament starts." />
          }
        />
      )}

      {tab === 'participants' && (
        <FlatList
          data={tournament.participants}
          keyExtractor={p => p.id}
          contentContainerStyle={{ padding: 16 }}
          onRefresh={() => void refetch()}
          refreshing={isRefetching}
          ListHeaderComponent={
            tournament.status === 'draft' ? (
              <View className="mb-4">
                {!isParticipant ? (
                  <Pressable
                    onPress={handleRegister}
                    disabled={registerParticipant.isPending}
                    className="bg-ds-red rounded-xl py-3 items-center flex-row justify-center gap-2 active:opacity-70"
                    accessibilityRole="button"
                    accessibilityLabel="Join tournament"
                  >
                    <UserPlus size={16} color="white" />
                    <Text className="text-sm font-barlow-semi text-white">Join Tournament</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={handleUnregister}
                    disabled={unregisterParticipant.isPending}
                    className="border border-ds-outline-variant rounded-xl py-3 items-center active:opacity-70"
                    accessibilityRole="button"
                    accessibilityLabel="Leave tournament"
                  >
                    <Text className="text-sm font-barlow-semi text-ds-on-surface-variant">Leave Tournament</Text>
                  </Pressable>
                )}
              </View>
            ) : null
          }
          renderItem={({ item, index }) => {
            const name = [item.user.firstName, item.user.lastName].filter(Boolean).join(' ') || item.user.username || 'Unknown';
            const isMe = item.user.id === userId;
            return (
              <View className={`flex-row items-center px-4 py-3 ${index < tournament.participants.length - 1 ? 'border-b border-ds-outline-variant' : ''}`}>
                {item.seeding != null && (
                  <Text className="w-7 text-sm font-barlow-semi text-ds-outline">{item.seeding}</Text>
                )}
                <Text className={`flex-1 text-sm font-barlow ${isMe ? 'text-ds-red' : 'text-ds-on-surface'}`}>
                  {name}{isMe ? ' (you)' : ''}
                </Text>
                {item.status === 'eliminated' && (
                  <Text className="text-xs font-barlow text-ds-outline">Eliminated</Text>
                )}
              </View>
            );
          }}
          ListEmptyComponent={
            <EmptyState icon={Users} title="No participants yet" message="Invite players to join this tournament." />
          }
        />
      )}

      {isAdmin && tournament.status !== 'cancelled' && tournament.status !== 'completed' && (
        <View className="px-6 pb-4 pt-2 border-t border-ds-outline-variant">
          <Pressable
            onPress={handleCancel}
            className="items-center py-3 active:opacity-70"
            accessibilityRole="button"
            accessibilityLabel="Cancel tournament"
          >
            <Text className="text-sm font-barlow-semi text-ds-red">Cancel Tournament</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

export default withErrorBoundary(TournamentScreen, 'tournament-detail');
