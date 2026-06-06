import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { gamePlayers, gameSessions, gameTurns } from '@/db/schema';
import {
  AROUND_THE_CLOCK_SLUG,
  BASEBALL_SLUG,
  BOBS_27_SLUG,
  CRICKET_SLUG,
  HALVE_IT_SLUG,
  HIGH_SCORE_SLUG,
  SHANGHAI_SLUG,
  X01_SLUG,
} from '@/constants/games';
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
import {
  processTurn as processX01Turn,
  type X01Config,
  type X01PlayerState,
} from '@/lib/games/x01';
import {
  processTurn as processShanghaiTurn,
  type ShanghaiPlayerState,
} from '@/lib/games/shanghai';
import {
  processTurn as processBaseballTurn,
  type BaseballPlayerState,
} from '@/lib/games/baseball';
import {
  processTurn as processHighScoreTurn,
  type HighScorePlayerState,
} from '@/lib/games/high-score';
import {
  processTurn as processHalveItTurn,
  type HalveItPlayerState,
} from '@/lib/games/halve-it';
import {
  processTurn as processBobs27Turn,
  type Bobs27PlayerState,
} from '@/lib/games/bobs-27';
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
  const bobs27AutoSubmitRef = useRef<string | null>(null);

  const [localTarget, setLocalTarget] = useState<number>(1);
  const [localCricketState, setLocalCricketState] =
    useState<CricketPlayerState | null>(null);
  const [localX01State, setLocalX01State] = useState<X01PlayerState | null>(null);

  const isAroundTheClock = gameState?.gameSlug === AROUND_THE_CLOCK_SLUG;
  const isCricket = gameState?.gameSlug === CRICKET_SLUG;
  const isX01 = gameState?.gameSlug === X01_SLUG;
  const isShanghai = gameState?.gameSlug === SHANGHAI_SLUG;
  const isBaseball = gameState?.gameSlug === BASEBALL_SLUG;
  const isHighScore = gameState?.gameSlug === HIGH_SCORE_SLUG;
  const isHalveIt = gameState?.gameSlug === HALVE_IT_SLUG;
  const isBobs27 = gameState?.gameSlug === BOBS_27_SLUG;

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
        setLocalX01State(null);
      } else if (session.gameSlug === CRICKET_SLUG) {
        setLocalCricketState(currentPlayer.gameState as CricketPlayerState);
        setLocalX01State(null);
      } else if (session.gameSlug === X01_SLUG) {
        setLocalX01State(currentPlayer.gameState as X01PlayerState);
        setLocalCricketState(null);
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
      // undefined = current player wins; null = tie (no winner); number = specific winner id
      winnerGamePlayerId?: number | null,
    ) => {
      if (!gameState) return;
      setIsProcessing(true);

      const currentPlayer = gameState.players[gameState.currentPlayerIndex];
      const isTie = isComplete && winnerGamePlayerId === null;

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
                !isTie &&
                isComplete &&
                (winnerGamePlayerId ?? currentPlayer.id) === currentPlayer.id,
            })
            .where(eq(gamePlayers.id, currentPlayer.id));

          if (
            !isTie &&
            isComplete &&
            winnerGamePlayerId !== undefined &&
            winnerGamePlayerId !== null &&
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

  const handleX01DartThrown = useCallback(
    async (dart: DartThrow) => {
      if (!gameState || isProcessing || !localX01State) return;

      const newDarts = [...turnDarts, dart];
      setTurnDarts(newDarts);

      const currentPlayer = gameState.players[gameState.currentPlayerIndex];
      const startState = currentPlayer.gameState as X01PlayerState;
      const config = gameState.config as X01Config;

      const result = processX01Turn(newDarts, startState, config);

      setLocalX01State(result.newState);

      const shouldEndTurn =
        result.isComplete || result.isBust || newDarts.length === 3;

      if (shouldEndTurn) {
        const newScore = config.startingScore - result.newState.remaining;
        await finishTurn(
          newDarts,
          result.scoreDelta,
          result.newState,
          newScore,
          result.isComplete,
        );
      }
    },
    [finishTurn, gameState, turnDarts, localX01State, isProcessing],
  );

  const handleRoundDartThrown = useCallback(
    async (dart: DartThrow) => {
      if (!gameState || isProcessing) return;

      const newDarts = [...turnDarts, dart];
      setTurnDarts(newDarts);

      if (newDarts.length < 3) return;

      const idx = gameState.currentPlayerIndex;
      const currentPlayer = gameState.players[idx];

      let isComplete = false;
      let scoreDelta = 0;
      let newPlayerState: unknown = null;
      let newScore = currentPlayer.currentScore;
      // undefined = current player wins, null = tie, number = specific winner id
      let winnerGamePlayerId: number | null | undefined;

      if (!isShanghai && !isBaseball && !isHighScore && !isHalveIt && !isBobs27) {
        console.warn('handleRoundDartThrown: unhandled game slug', gameState.gameSlug);
        return;
      }

      const resolveWinner = (winnerIndex: number | null) => {
        if (!isComplete) return;
        winnerGamePlayerId =
          winnerIndex !== null ? gameState.players[winnerIndex].id : null;
      };

      if (isShanghai) {
        const allStates = gameState.players.map(
          (p) => p.gameState as ShanghaiPlayerState,
        );
        const result = processShanghaiTurn(
          newDarts,
          currentPlayer.gameState as ShanghaiPlayerState,
          allStates,
          idx,
        );
        isComplete = result.isComplete;
        scoreDelta = result.scoreDelta;
        newPlayerState = result.newState;
        newScore = result.newState.totalScore;
        resolveWinner(result.winnerIndex);
      } else if (isBaseball) {
        const allStates = gameState.players.map(
          (p) => p.gameState as BaseballPlayerState,
        );
        const result = processBaseballTurn(
          newDarts,
          currentPlayer.gameState as BaseballPlayerState,
          allStates,
          idx,
        );
        isComplete = result.isComplete;
        scoreDelta = result.scoreDelta;
        newPlayerState = result.newState;
        newScore = result.newState.totalRuns;
        resolveWinner(result.winnerIndex);
      } else if (isHighScore) {
        const allStates = gameState.players.map(
          (p) => p.gameState as HighScorePlayerState,
        );
        const result = processHighScoreTurn(
          newDarts,
          currentPlayer.gameState as HighScorePlayerState,
          allStates,
          idx,
        );
        isComplete = result.isComplete;
        scoreDelta = result.scoreDelta;
        newPlayerState = result.newState;
        newScore = result.newState.totalScore;
        resolveWinner(result.winnerIndex);
      } else if (isHalveIt) {
        const allStates = gameState.players.map(
          (p) => p.gameState as HalveItPlayerState,
        );
        const result = processHalveItTurn(
          newDarts,
          currentPlayer.gameState as HalveItPlayerState,
          allStates,
          idx,
        );
        isComplete = result.isComplete;
        scoreDelta = result.scoreDelta;
        newPlayerState = result.newState;
        newScore = result.newState.score;
        resolveWinner(result.winnerIndex);
      } else if (isBobs27) {
        const allStates = gameState.players.map(
          (p) => p.gameState as Bobs27PlayerState,
        );
        const result = processBobs27Turn(
          newDarts,
          currentPlayer.gameState as Bobs27PlayerState,
          allStates,
          idx,
        );
        isComplete = result.isComplete;
        scoreDelta = result.scoreDelta;
        newPlayerState = result.newState;
        newScore = result.newState.score;
        resolveWinner(result.winnerIndex);
      }

      await finishTurn(
        newDarts,
        scoreDelta,
        newPlayerState,
        newScore,
        isComplete,
        winnerGamePlayerId,
      );
    },
    [
      finishTurn,
      gameState,
      turnDarts,
      isProcessing,
      isShanghai,
      isBaseball,
      isHighScore,
      isHalveIt,
      isBobs27,
    ],
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

  useEffect(() => {
    if (!isBobs27 || !gameState || isProcessing) return;
    const idx = gameState.currentPlayerIndex;
    const player = gameState.players[idx];
    const state = player?.gameState as Bobs27PlayerState | undefined;
    if (!state?.eliminated) return;

    const key = `${player.id}:${state.currentRound}`;
    if (bobs27AutoSubmitRef.current === key) return;
    bobs27AutoSubmitRef.current = key;

    const misses: DartThrow[] = [
      { segment: 0, multiplier: 0 },
      { segment: 0, multiplier: 0 },
      { segment: 0, multiplier: 0 },
    ];
    const allStates = gameState.players.map((p) => p.gameState as Bobs27PlayerState);
    const result = processBobs27Turn(misses, state, allStates, idx);
    const winnerGamePlayerId: number | null | undefined =
      result.isComplete
        ? result.winnerIndex !== null
          ? gameState.players[result.winnerIndex].id
          : null
        : undefined;

    void finishTurn(
      misses,
      result.scoreDelta,
      result.newState,
      result.newState.score,
      result.isComplete,
      winnerGamePlayerId,
    );
  }, [gameState, isBobs27, isProcessing, finishTurn]);

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
    isShanghai,
    isBaseball,
    isHighScore,
    isHalveIt,
    isBobs27,
    localTarget,
    localCricketState,
    localX01State,
    handleATCDartThrown,
    handleCricketDartThrown,
    handleX01DartThrown,
    handleRoundDartThrown,
    handleQuit,
    isX01,
  };
}
