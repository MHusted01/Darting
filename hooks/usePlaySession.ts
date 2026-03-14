import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { gamePlayers, gameSessions, gameTurns } from '@/db/schema';
import { AROUND_THE_CLOCK_SLUG, CRICKET_SLUG } from '@/constants/games';
import {
  getMaxTarget,
  getTargetSegment,
  type AroundTheClockConfig,
  type AroundTheClockPlayerState,
} from '@/lib/games/around-the-clock';
import {
  processTurn as processCricketTurn,
  type CricketConfig,
  type CricketPlayerState,
} from '@/lib/games/cricket';
import type { DartThrow } from '@/types/game';

export interface LoadedPlayer {
  id: number; // gamePlayers.id
  playerId: number;
  playerOrder: number;
  name: string;
  avatarColor: string;
  currentScore: number;
  gameState: unknown;
  isWinner: boolean;
}

export interface LoadedGameState {
  sessionId: number;
  gameSlug: string;
  currentRound: number;
  currentPlayerIndex: number;
  config: unknown;
  players: LoadedPlayer[];
}

interface UsePlaySessionParams {
  slug?: string;
  sessionId?: string;
}

export function usePlaySession({ slug, sessionId }: UsePlaySessionParams) {
  const router = useRouter();

  const [gameState, setGameState] = useState<LoadedGameState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [turnDarts, setTurnDarts] = useState<DartThrow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const [localTarget, setLocalTarget] = useState<number>(1);
  const [localCricketState, setLocalCricketState] =
    useState<CricketPlayerState | null>(null);

  const isAroundTheClock = gameState?.gameSlug === AROUND_THE_CLOCK_SLUG;
  const isCricket = gameState?.gameSlug === CRICKET_SLUG;

  const loadSession = useCallback(async () => {
    setLoadError(null);

    if (!sessionId) {
      setGameState(null);
      setLoadError('Missing game session.');
      return;
    }

    try {
      const session = await db.query.gameSessions.findFirst({
        where: eq(gameSessions.id, Number(sessionId)),
        with: {
          gamePlayers: {
            with: { player: true },
            orderBy: [asc(gamePlayers.playerOrder)],
          },
        },
      });

      if (!session || session.status !== 'in_progress') {
        setGameState(null);
        setLoadError('This session is no longer active.');
        return;
      }

      const loadedPlayers: LoadedPlayer[] = session.gamePlayers.map((gp) => ({
        id: gp.id,
        playerId: gp.playerId,
        playerOrder: gp.playerOrder,
        name: gp.player.name,
        avatarColor: gp.player.avatarColor,
        currentScore: gp.currentScore,
        gameState: gp.gameState,
        isWinner: gp.isWinner ?? false,
      }));

      setGameState({
        sessionId: session.id,
        gameSlug: session.gameSlug,
        currentRound: session.currentRound,
        currentPlayerIndex: session.currentPlayerIndex,
        config: session.config,
        players: loadedPlayers,
      });

      setTurnDarts([]);
      const currentPlayer = loadedPlayers[session.currentPlayerIndex];

      if (session.gameSlug === AROUND_THE_CLOCK_SLUG) {
        const atcState = currentPlayer.gameState as AroundTheClockPlayerState;
        setLocalTarget(atcState.currentTarget);
        setLocalCricketState(null);
      } else if (session.gameSlug === CRICKET_SLUG) {
        setLocalCricketState(currentPlayer.gameState as CricketPlayerState);
      }
    } catch (error) {
      console.error('Failed to load game session:', error);
      setGameState(null);
      setLoadError('Failed to load game session.');
    }
  }, [sessionId]);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  const finishTurn = useCallback(
    async (
      darts: DartThrow[],
      scoreDelta: number,
      newPlayerState: unknown,
      newScore: number,
      isComplete: boolean,
      winnerGamePlayerId?: number,
    ) => {
      if (!gameState) return;
      setIsProcessing(true);

      const currentPlayer = gameState.players[gameState.currentPlayerIndex];

      try {
        await db.transaction(async (tx) => {
          await tx.insert(gameTurns).values({
            gameSessionId: gameState.sessionId,
            playerId: currentPlayer.playerId,
            roundNumber: gameState.currentRound,
            darts,
            scoreDelta,
          });

          await tx
            .update(gamePlayers)
            .set({
              currentScore: newScore,
              gameState: newPlayerState as Record<string, unknown>,
              isWinner:
                isComplete &&
                (winnerGamePlayerId ?? currentPlayer.id) === currentPlayer.id,
            })
            .where(eq(gamePlayers.id, currentPlayer.id));

          if (
            isComplete &&
            winnerGamePlayerId !== undefined &&
            winnerGamePlayerId !== currentPlayer.id
          ) {
            await tx
              .update(gamePlayers)
              .set({ isWinner: true })
              .where(eq(gamePlayers.id, winnerGamePlayerId));
          }

          if (isComplete) {
            await tx
              .update(gameSessions)
              .set({ status: 'completed', completedAt: new Date() })
              .where(eq(gameSessions.id, gameState.sessionId));
          } else {
            const playerCount = gameState.players.length;
            const nextIdx = (gameState.currentPlayerIndex + 1) % playerCount;
            const nextRound =
              nextIdx === 0
                ? gameState.currentRound + 1
                : gameState.currentRound;

            await tx
              .update(gameSessions)
              .set({
                currentPlayerIndex: nextIdx,
                currentRound: nextRound,
              })
              .where(eq(gameSessions.id, gameState.sessionId));
          }
        });

        if (isComplete) {
          router.replace(`/game/${slug}/results?sessionId=${gameState.sessionId}`);
        } else {
          await loadSession();
        }
      } catch (error) {
        console.error('Failed to finish turn:', error);
        Alert.alert('Error', 'Failed to record turn.');
        try {
          await loadSession();
        } catch (reloadError) {
          console.error('Failed to reload session after turn error:', reloadError);
        }
      } finally {
        setIsProcessing(false);
      }
    },
    [gameState, loadSession, router, slug],
  );

  const handleATCDartThrown = useCallback(
    async (dart: DartThrow) => {
      if (!gameState || isProcessing) return;

      const newDarts = [...turnDarts, dart];
      setTurnDarts(newDarts);

      let newTarget = localTarget;
      if (dart.segment === getTargetSegment(localTarget) && dart.multiplier > 0) {
        newTarget = localTarget + 1;
        setLocalTarget(newTarget);
      }

      const config = gameState.config as AroundTheClockConfig;
      const maxTarget = getMaxTarget(config);
      const currentPlayer = gameState.players[gameState.currentPlayerIndex];
      const startTarget = (currentPlayer.gameState as AroundTheClockPlayerState)
        .currentTarget;

      if (newTarget > maxTarget) {
        await finishTurn(
          newDarts,
          newTarget - startTarget,
          { currentTarget: newTarget } satisfies AroundTheClockPlayerState,
          currentPlayer.currentScore + (newTarget - startTarget),
          true,
        );
        return;
      }

      if (newDarts.length === 3) {
        await finishTurn(
          newDarts,
          newTarget - startTarget,
          { currentTarget: newTarget } satisfies AroundTheClockPlayerState,
          currentPlayer.currentScore + (newTarget - startTarget),
          false,
        );
      }
    },
    [finishTurn, gameState, turnDarts, localTarget, isProcessing],
  );

  const handleCricketDartThrown = useCallback(
    async (dart: DartThrow) => {
      if (!gameState || isProcessing) return;

      const newDarts = [...turnDarts, dart];
      setTurnDarts(newDarts);

      const currentPlayer = gameState.players[gameState.currentPlayerIndex];
      const startState = currentPlayer.gameState as CricketPlayerState;
      const config = gameState.config as CricketConfig;

      const allPlayerStates = gameState.players.map(
        (player) => player.gameState as CricketPlayerState,
      );
      const result = processCricketTurn(
        newDarts,
        startState,
        allPlayerStates,
        gameState.currentPlayerIndex,
        config,
      );

      setLocalCricketState(result.newState);

      if (result.isComplete) {
        const winnerGamePlayerId =
          result.winnerIndex !== null
            ? gameState.players[result.winnerIndex].id
            : currentPlayer.id;
        await finishTurn(
          newDarts,
          result.scoreDelta,
          result.newState,
          result.newState.points,
          true,
          winnerGamePlayerId,
        );
        return;
      }

      if (newDarts.length === 3) {
        await finishTurn(
          newDarts,
          result.scoreDelta,
          result.newState,
          result.newState.points,
          false,
        );
      }
    },
    [finishTurn, gameState, turnDarts, isProcessing],
  );

  const handleQuit = useCallback(() => {
    Alert.alert('Quit Game', 'Are you sure you want to abandon this game?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Quit',
        style: 'destructive',
        onPress: async () => {
          if (!gameState) return;

          try {
            await db
              .update(gameSessions)
              .set({ status: 'abandoned', completedAt: new Date() })
              .where(eq(gameSessions.id, gameState.sessionId));
            router.replace('/(protected)/(tabs)');
          } catch (error) {
            console.error('Failed to abandon game:', error);
            Alert.alert('Error', 'Failed to quit game. Please try again.');
          }
        },
      },
    ]);
  }, [gameState, router]);

  const currentPlayer =
    gameState !== null
      ? gameState.players[gameState.currentPlayerIndex]
      : null;

  return {
    gameState,
    currentPlayer,
    loadError,
    turnDarts,
    isProcessing,
    isAroundTheClock,
    isCricket,
    localTarget,
    localCricketState,
    handleATCDartThrown,
    handleCricketDartThrown,
    handleQuit,
  };
}
