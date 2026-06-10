import { useState, useCallback, useEffect, useMemo } from 'react';
import { DS_COLORS } from '@/constants/colors';
import { withErrorBoundary } from '@/components/ErrorBoundary';
import { View, Text, Pressable, Switch, ScrollView, Alert } from 'react-native';
import Skeleton from '@/components/ui/Skeleton';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useUser } from '@clerk/expo';
import { useSupabase } from '@/providers/SupabaseProvider';
import { getOrCreateUserPlayer } from '@/lib/player';
import { useFriends } from '@/hooks/useFriends';
import { useMyClubs } from '@/hooks/useClubs';
import { SocialContactPicker } from '@/components/games/SocialContactPicker';
import type { ContactPlayer } from '@/types/social';
import {
  GAMES,
  IMPLEMENTED_SLUGS,
  AROUND_THE_CLOCK_SLUG,
  BASEBALL_SLUG,
  BERMUDA_TRIANGLE_SLUG,
  BOBS_27_SLUG,
  CRICKET_SLUG,
  HALVE_IT_SLUG,
  HIGH_SCORE_SLUG,
  KILLER_SLUG,
  SHANGHAI_SLUG,
  X01_SLUG,
} from '@/constants/games';
import { db } from '@/db/client';
import { players as playersTable, gameSessions, gamePlayers } from '@/db/schema';
import {
  PlayerManager,
  getNextAvatarColor,
  type Player,
} from '@/components/PlayerManager';
import { getInitialPlayerState as getATCInitialState } from '@/lib/games/around-the-clock';
import type { AroundTheClockConfig } from '@/lib/games/around-the-clock';
import { getInitialPlayerState as getCricketInitialState } from '@/lib/games/cricket';
import type { CricketConfig } from '@/lib/games/cricket';
import { getInitialPlayerState as getX01InitialState } from '@/lib/games/x01';
import type { X01Config } from '@/lib/games/x01';
import { getInitialPlayerState as getShanghaiInitialState } from '@/lib/games/shanghai';
import { getInitialPlayerState as getBaseballInitialState } from '@/lib/games/baseball';
import { getInitialPlayerState as getHighScoreInitialState } from '@/lib/games/high-score';
import { getInitialPlayerState as getHalveItInitialState } from '@/lib/games/halve-it';
import { getInitialPlayerState as getBobs27InitialState } from '@/lib/games/bobs-27';
import { getInitialPlayerState as getBermudaTriangleInitialState } from '@/lib/games/bermuda-triangle';
import { getInitialPlayerState as getKillerInitialState } from '@/lib/games/killer';

function getInitialState(slug: string, startingScore: 501 | 301 = 501) {
  switch (slug) {
    case AROUND_THE_CLOCK_SLUG: return getATCInitialState();
    case CRICKET_SLUG: return getCricketInitialState();
    case X01_SLUG: return getX01InitialState({ startingScore });
    case SHANGHAI_SLUG: return getShanghaiInitialState();
    case BASEBALL_SLUG: return getBaseballInitialState();
    case HIGH_SCORE_SLUG: return getHighScoreInitialState();
    case HALVE_IT_SLUG: return getHalveItInitialState();
    case BOBS_27_SLUG: return getBobs27InitialState();
    case BERMUDA_TRIANGLE_SLUG: return getBermudaTriangleInitialState();
    case KILLER_SLUG: return getKillerInitialState();
    default: throw new Error(`Unknown game slug: ${slug}`);
  }
}

function getConfig(slug: string, includeBull: boolean, startingScore: 501 | 301 = 501): unknown {
  if (slug === AROUND_THE_CLOCK_SLUG) return { includeBull } satisfies AroundTheClockConfig;
  if (slug === CRICKET_SLUG) return { variant: 'standard' } satisfies CricketConfig;
  if (slug === X01_SLUG) return { startingScore } satisfies X01Config;
  return {};
}

function GameSetup() {
  const router = useRouter();
  const {
    slug,
    tournamentMatchId,
    tmP1Id,
    tmP2Id,
    p1UserId,
    p2UserId,
  } = useLocalSearchParams<{
    slug: string;
    tournamentMatchId?: string;
    tmP1Id?: string;
    tmP2Id?: string;
    p1UserId?: string;
    p2UserId?: string;
  }>();
  const normalizedSlug = Array.isArray(slug) ? slug[0] : slug;
  const isTournamentMatch = Boolean(tournamentMatchId && tmP1Id && tmP2Id && p1UserId && p2UserId);
  const supabase = useSupabase();
  const game = GAMES.find((g) => g.slug === normalizedSlug);
  const isAroundTheClock = normalizedSlug === AROUND_THE_CLOCK_SLUG;
  const isCricket = normalizedSlug === CRICKET_SLUG;
  const isX01 = normalizedSlug === X01_SLUG;
  const isKiller = normalizedSlug === KILLER_SLUG;

  const { isLoaded, user } = useUser();
  const [selectedPlayers, setSelectedPlayers] = useState<Player[]>([]);
  const [userPlayerId, setUserPlayerId] = useState<number | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [lockedPlayerIds, setLockedPlayerIds] = useState<Set<number>>(new Set());
  const [includeBull, setIncludeBull] = useState(false);
  const [startingScore, setStartingScore] = useState<501 | 301>(501);
  const [isStarting, setIsStarting] = useState(false);

  const { data: friends = [] } = useFriends();
  const { data: myClubs = [] } = useMyClubs();

  const addedContactUserIds = useMemo<ReadonlySet<string>>(
    () => new Set(selectedPlayers.filter((p) => p.userId).map((p) => p.userId!)),
    [selectedPlayers],
  );

  useEffect(() => {
    if (!isLoaded || isTournamentMatch) return;
    if (!user) {
      setIsLoadingUser(false);
      return;
    }
    let cancelled = false;
    const displayName = user.firstName ?? user.username ?? 'Me';
    getOrCreateUserPlayer(user.id, displayName)
      .then((player) => {
        if (cancelled) return;
        setSelectedPlayers((prev) => {
          const withoutUser = prev.filter((p) => p.id !== player.id);
          return [{ id: player.id, name: player.name, avatarColor: player.avatarColor }, ...withoutUser];
        });
        setUserPlayerId(player.id);
        setIsLoadingUser(false);
      })
      .catch(() => {
        if (cancelled) return;
        setIsLoadingUser(false);
        Alert.alert('Error', 'Could not load your player profile. Please try again.');
      });
    return () => { cancelled = true; };
  }, [isLoaded, user, isTournamentMatch]);

  useEffect(() => {
    if (!isTournamentMatch || !supabase || !isLoaded) return;
    let cancelled = false;

    async function populateTournamentPlayers() {
      if (!p1UserId || !p2UserId) return;
      try {
        const { data: users } = await supabase!
          .from('users')
          .select('id, first_name, last_name, username')
          .in('id', [p1UserId, p2UserId]);

        if (cancelled || !users) return;

        const userMap = new Map(users.map((u: { id: string; first_name: string | null; last_name: string | null; username: string | null }) => [u.id, u]));
        const u1 = userMap.get(p1UserId!);
        const u2 = userMap.get(p2UserId!);

        const name1 = u1 ? ([u1.first_name, u1.last_name].filter(Boolean).join(' ') || u1.username || 'Player 1') : 'Player 1';
        const name2 = u2 ? ([u2.first_name, u2.last_name].filter(Boolean).join(' ') || u2.username || 'Player 2') : 'Player 2';

        const color1 = getNextAvatarColor(0);
        const color2 = getNextAvatarColor(1);

        const [player1] = await db
          .insert(playersTable)
          .values({ name: name1, userId: p1UserId!, avatarColor: color1 })
          .onConflictDoUpdate({ target: playersTable.userId, set: { name: name1 } })
          .returning();
        const [player2] = await db
          .insert(playersTable)
          .values({ name: name2, userId: p2UserId!, avatarColor: color2 })
          .onConflictDoUpdate({ target: playersTable.userId, set: { name: name2 } })
          .returning();

        if (cancelled) return;
        setSelectedPlayers([
          { id: player1.id, name: player1.name, avatarColor: player1.avatarColor, userId: p1UserId! },
          { id: player2.id, name: player2.name, avatarColor: player2.avatarColor, userId: p2UserId! },
        ]);
        setLockedPlayerIds(new Set([player1.id, player2.id]));
        setIsLoadingUser(false);
      } catch {
        if (!cancelled) {
          setIsLoadingUser(false);
          Alert.alert('Error', 'Could not load tournament players. Please try again.');
        }
      }
    }

    void populateTournamentPlayers();
    return () => { cancelled = true; };
  }, [isTournamentMatch, supabase, isLoaded, p1UserId, p2UserId]);

  const handleAddPlayer = useCallback(async (name: string) => {
    try {
      const color = getNextAvatarColor(selectedPlayers.length);
      const [inserted] = await db
        .insert(playersTable)
        .values({ name, avatarColor: color })
        .returning();
      setSelectedPlayers((prev) => [
        ...prev,
        { id: inserted.id, name: inserted.name, avatarColor: inserted.avatarColor },
      ]);
    } catch {
      Alert.alert('Error', 'Failed to add player. Please try again.');
    }
  }, [selectedPlayers.length]);

  const handleRemovePlayer = useCallback((playerId: number) => {
    setSelectedPlayers((prev) => prev.filter((p) => p.id !== playerId));
  }, []);

  const handleAddContact = useCallback(async (contact: ContactPlayer) => {
    try {
      const color = getNextAvatarColor(selectedPlayers.length);
      const [player] = await db
        .insert(playersTable)
        .values({ name: contact.displayName, userId: contact.userId, avatarColor: color })
        .onConflictDoUpdate({ target: playersTable.userId, set: { name: contact.displayName, avatarColor: color } })
        .returning();
      setSelectedPlayers((prev) => {
        if (prev.some((p) => p.userId === contact.userId)) return prev;
        return [...prev, { id: player.id, name: player.name, avatarColor: player.avatarColor, userId: contact.userId }];
      });
    } catch {
      Alert.alert('Error', 'Failed to add player. Please try again.');
    }
  }, [selectedPlayers.length]);

  const minPlayers = isX01 ? 1 : isCricket ? 2 : isKiller ? 3 : 1;

  const handleStartGame = async () => {
    if (selectedPlayers.length < minPlayers || isStarting || isLoadingUser) return;

    if (!IMPLEMENTED_SLUGS.has(normalizedSlug)) {
      Alert.alert('Not available yet', 'This game mode is not implemented yet.');
      return;
    }

    setIsStarting(true);

    try {
      const config = getConfig(normalizedSlug, includeBull, startingScore);

      const session = await db.transaction(async (tx) => {
        const [createdSession] = await tx
          .insert(gameSessions)
          .values({
            gameSlug: normalizedSlug,
            status: 'in_progress',
            context: isTournamentMatch ? 'tournament' : 'casual',
            currentRound: 1,
            currentPlayerIndex: 0,
            config,
            startedAt: new Date(),
            ...(isTournamentMatch && {
              tournamentMatchId: tournamentMatchId ?? null,
              tournamentParticipant1Id: tmP1Id ?? null,
              tournamentParticipant2Id: tmP2Id ?? null,
            }),
          })
          .returning();

        for (let i = 0; i < selectedPlayers.length; i++) {
          await tx.insert(gamePlayers).values({
            gameSessionId: createdSession.id,
            playerId: selectedPlayers[i].id,
            playerOrder: i,
            currentScore: 0,
            gameState: getInitialState(normalizedSlug, startingScore) as Record<string, unknown>,
          });
        }

        return createdSession;
      });

      router.push(`/game/${normalizedSlug}/play?sessionId=${session.id}`);
    } catch {
      Alert.alert('Error', 'Failed to start game. Please try again.');
      setIsStarting(false);
    }
  };

  if (!game) {
    return (
      <View className="flex-1 justify-center items-center bg-ds-bg">
        <Text className="text-lg font-barlow text-ds-on-surface-variant">Game not found</Text>
      </View>
    );
  }

  const Icon = game.icon;
  const canStart = selectedPlayers.length >= minPlayers && !isStarting && !isLoadingUser;

  return (
    <ScrollView
      className="flex-1 bg-ds-bg"
      contentContainerClassName="px-6 pb-12 pt-6"
      keyboardShouldPersistTaps="handled"
    >
      <View className="items-center mb-8">
        <View className="w-16 h-16 rounded-2xl bg-ds-surface-container items-center justify-center mb-4">
          <Icon size={32} color={DS_COLORS.onSurface} />
        </View>
        <Text className="text-2xl font-barlow-condensed text-ds-on-surface mb-1">{game.name}</Text>
        <Text className="text-base font-barlow text-ds-on-surface-variant text-center">
          {game.description}
        </Text>
      </View>

      {!isLoadingUser && !isTournamentMatch && (
        <SocialContactPicker
          friends={friends.filter((f) => f.id !== user?.id)}
          clubs={myClubs}
          addedContactUserIds={addedContactUserIds}
          onAdd={handleAddContact}
        />
      )}

      {isTournamentMatch && isLoadingUser ? (
        <View className="py-4 gap-2">
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-14 w-full rounded-xl" />
        </View>
      ) : (
        <PlayerManager
          players={selectedPlayers}
          onAddPlayer={isTournamentMatch ? undefined : handleAddPlayer}
          onRemovePlayer={(id) => {
            if (!lockedPlayerIds.has(id)) handleRemovePlayer(id);
          }}
          minPlayers={minPlayers}
          lockedPlayerId={isTournamentMatch ? undefined : (userPlayerId ?? undefined)}
          lockedPlayerIds={isTournamentMatch ? lockedPlayerIds : undefined}
        />
      )}

      {isAroundTheClock && (
        <View className="mt-6 bg-ds-surface border border-ds-outline-variant rounded-xl p-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 mr-4">
              <Text className="text-base font-barlow-semi text-ds-on-surface">
                Include Bull
              </Text>
              <Text className="text-sm font-barlow text-ds-on-surface-variant mt-1">
                Add bullseye as target #21 after completing 1–20
              </Text>
            </View>
            <Switch
              value={includeBull}
              onValueChange={setIncludeBull}
              trackColor={{ false: DS_COLORS.outlineVariant, true: DS_COLORS.red }}
              thumbColor={DS_COLORS.surface}
              accessibilityLabel="Include bull as target 21"
            />
          </View>
        </View>
      )}

      {isCricket && (
        <View className="mt-6 bg-ds-surface border border-ds-outline-variant rounded-xl p-4">
          <Text className="text-base font-barlow-semi text-ds-on-surface">Standard Cricket</Text>
          <Text className="text-sm font-barlow text-ds-on-surface-variant mt-1">
            Close 15–20 and Bull. Score points on segments your opponents have not closed.
          </Text>
        </View>
      )}

      {isX01 && (
        <View className="mt-6 border border-ds-outline-variant rounded-xl p-4 bg-ds-surface">
          <Text className="text-xs font-barlow-semi text-ds-on-surface-variant uppercase tracking-widest mb-3">
            Starting Score
          </Text>
          <View className="flex-row gap-3">
            {([501, 301] as const).map((score) => (
              <Pressable
                key={score}
                onPress={() => setStartingScore(score)}
                className={`flex-1 rounded-xl py-3 items-center active:opacity-70 ${
                  startingScore === score
                    ? 'bg-ds-red'
                    : 'bg-ds-surface-low border border-ds-outline-variant'
                }`}
                accessibilityRole="button"
                accessibilityLabel={`${score} starting score`}
                accessibilityState={{ selected: startingScore === score }}
              >
                <Text
                  className={`text-lg font-barlow-semi ${
                    startingScore === score ? 'text-ds-on-red' : 'text-ds-on-surface'
                  }`}
                >
                  {score}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text className="text-xs font-barlow text-ds-on-surface-variant mt-3">
            Must finish on a double. Turn busts if remaining goes below 2 or lands on 1.
          </Text>
        </View>
      )}

      <Pressable
        onPress={handleStartGame}
        disabled={!canStart}
        className={`mt-8 rounded-xl py-4 items-center ${
          canStart ? 'bg-ds-red active:opacity-70' : 'bg-ds-surface-container'
        }`}
        accessibilityRole="button"
        accessibilityLabel="Start game"
      >
        <Text
          className={`text-lg font-barlow-semi ${canStart ? 'text-ds-on-red' : 'text-ds-outline'}`}
        >
          {isStarting ? 'Starting...' : 'Start Game'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

export default withErrorBoundary(GameSetup, 'game-setup');
