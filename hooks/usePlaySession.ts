import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useAuth } from '@clerk/expo';
import { useRouter } from 'expo-router';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { impact, notify } from '@/lib/haptics';
import { gamePlayers, gameSessions, gameTurns } from '@/db/schema';
import {
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
import {
  processTurn as processBermudaTriangleTurn,
  type BermudaTrianglePlayerState,
} from '@/lib/games/bermuda-triangle';
import {
  processTurn as processKillerTurn,
  derivePhase as deriveKillerPhase,
  getNextPlayerIndex as getKillerNextPlayerIndex,
  type KillerPlayerState,
} from '@/lib/games/killer';
import type { DartThrow } from '@/types/game';
import { sessionThreeDartAvg } from '@/lib/stats';
import { applyGameTurn as applyChallengeTurn } from '@/lib/realtime-game';
import { syncCompletedSession } from '@/lib/supabase-sync';
import { computeSessionAnalytics } from '@/lib/games/analytics';
import { isMissedCheckoutCandidate } from '@/lib/checkout-inference';

export interface LoadedPlayer {
  id: number; // gamePlayers.id
  playerId: number;
  playerOrder: number;
  userId: string | null;
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
  onBeforeCommitTurn?: (
    darts: DartThrow[],
    isComplete: boolean,
    winnerGamePlayerId: number | null | undefined,
    gameState: LoadedGameState,
    newScore: number,
  ) => Promise<void>;
  onQuitConfirmed?: () => Promise<void>;
}

export function usePlaySession({
  slug,
  sessionId,
  onBeforeCommitTurn,
  onQuitConfirmed,
}: UsePlaySessionParams) {
  const router = useRouter();
  const { userId, getToken } = useAuth();

  const [gameState, setGameState] = useState<LoadedGameState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [turnDarts, setTurnDarts] = useState<DartThrow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const bobs27AutoSubmitRef = useRef<string | null>(null);

  const [localTarget, setLocalTarget] = useState<number>(1);
  const [localCricketState, setLocalCricketState] =
    useState<CricketPlayerState | null>(null);
  const [localX01State, setLocalX01State] = useState<X01PlayerState | null>(null);
  // The just-committed X01 turn that missed a checkout without throwing a double —
  // eligible for the optional "missed target?" exact-tracking chip.
  const [missedCheckout, setMissedCheckout] = useState<{ turnId: number } | null>(null);

  const isAroundTheClock = gameState?.gameSlug === AROUND_THE_CLOCK_SLUG;
  const isCricket = gameState?.gameSlug === CRICKET_SLUG;
  const isX01 = gameState?.gameSlug === X01_SLUG;
  const isShanghai = gameState?.gameSlug === SHANGHAI_SLUG;
  const isBaseball = gameState?.gameSlug === BASEBALL_SLUG;
  const isHighScore = gameState?.gameSlug === HIGH_SCORE_SLUG;
  const isHalveIt = gameState?.gameSlug === HALVE_IT_SLUG;
  const isBobs27 = gameState?.gameSlug === BOBS_27_SLUG;
  const isBermudaTriangle = gameState?.gameSlug === BERMUDA_TRIANGLE_SLUG;
  const isKiller = gameState?.gameSlug === KILLER_SLUG;

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
        userId: gp.player.userId,
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
      additionalUpdates?: { gamePlayerId: number; newState: unknown; newScore?: number }[],
      nextPlayerOverride?: number,
      isRemote?: boolean,
    ) => {
      if (!gameState) return null;
      setIsProcessing(true);

      const currentPlayer = gameState.players[gameState.currentPlayerIndex];
      const isTie = isComplete && winnerGamePlayerId === null;
      let insertedTurnId: number | null = null;

      try {
        if (!isRemote && onBeforeCommitTurn) {
          await onBeforeCommitTurn(darts, isComplete, winnerGamePlayerId, gameState, newScore);
        }

        await db.transaction(async (tx) => {
          const inserted = await tx
            .insert(gameTurns)
            .values({
              gameSessionId: gameState.sessionId,
              playerId: currentPlayer.playerId,
              roundNumber: gameState.currentRound,
              darts,
              scoreDelta,
            })
            .returning({ id: gameTurns.id });
          insertedTurnId = inserted[0]?.id ?? null;

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

          if (additionalUpdates) {
            for (const update of additionalUpdates) {
              await tx
                .update(gamePlayers)
                .set({
                  gameState: update.newState as Record<string, unknown>,
                  ...(update.newScore !== undefined ? { currentScore: update.newScore } : {}),
                })
                .where(eq(gamePlayers.id, update.gamePlayerId));
            }
          }

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
            const allTurns = await tx
              .select({
                playerId: gameTurns.playerId,
                roundNumber: gameTurns.roundNumber,
                darts: gameTurns.darts,
                scoreDelta: gameTurns.scoreDelta,
                intendedTarget: gameTurns.intendedTarget,
              })
              .from(gameTurns)
              .where(eq(gameTurns.gameSessionId, gameState.sessionId))
              .orderBy(asc(gameTurns.roundNumber), asc(gameTurns.id));

            const turnsByPlayer = new Map<number, Array<{ darts: number; scoreDelta: number }>>();
            const fullTurnsByPlayer = new Map<number, Array<{ roundNumber: number; darts: DartThrow[]; scoreDelta: number; intendedTarget: number | null }>>();

            for (const turn of allTurns) {
              const darts = turn.darts as DartThrow[];
              const entry = turnsByPlayer.get(turn.playerId) ?? [];
              entry.push({ darts: darts.length, scoreDelta: turn.scoreDelta });
              turnsByPlayer.set(turn.playerId, entry);

              const fullEntry = fullTurnsByPlayer.get(turn.playerId) ?? [];
              fullEntry.push({ roundNumber: turn.roundNumber, darts, scoreDelta: turn.scoreDelta, intendedTarget: turn.intendedTarget ?? null });
              fullTurnsByPlayer.set(turn.playerId, fullEntry);
            }

            for (const [pid, turns] of turnsByPlayer) {
              const playerAvg = sessionThreeDartAvg(gameState.gameSlug, turns);
              const playerFullTurns = fullTurnsByPlayer.get(pid) ?? [];
              const analytics = computeSessionAnalytics(
                gameState.gameSlug,
                playerFullTurns,
                gameState.config,
              );

              await tx
                .update(gamePlayers)
                .set({ threeDartAvg: playerAvg, analytics })
                .where(
                  and(
                    eq(gamePlayers.gameSessionId, gameState.sessionId),
                    eq(gamePlayers.playerId, pid),
                  ),
                );
            }

            await tx
              .update(gameSessions)
              .set({ status: 'completed', completedAt: new Date() })
              .where(eq(gameSessions.id, gameState.sessionId));
          } else {
            const playerCount = gameState.players.length;
            const nextIdx =
              nextPlayerOverride ?? (gameState.currentPlayerIndex + 1) % playerCount;
            const nextRound =
              nextIdx <= gameState.currentPlayerIndex
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

        if (!isRemote) {
          if (isComplete) {
            void notify('success');
          } else {
            void impact('light');
          }
        }

        if (isComplete) {
          if (userId) {
            void syncCompletedSession(gameState.sessionId, userId, getToken)
              .catch((err) => console.error('Sync failed, will retry on next launch:', err));
          }
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
        return null;
      } finally {
        setIsProcessing(false);
      }

      return insertedTurnId;
    },
    [gameState, loadSession, router, slug, userId, getToken, onBeforeCommitTurn],
  );

  const pendingRemoteTurnsRef = useRef<
    { darts: DartThrow[]; remoteUserId: string; localUserId: string }[]
  >([]);

  const applyRemoteTurn = useCallback(
    async (darts: DartThrow[], remoteUserId: string, localUserId: string) => {
      if (remoteUserId === localUserId) return;
      if (!gameState || isProcessing) {
        pendingRemoteTurnsRef.current.push({ darts, remoteUserId, localUserId });
        return;
      }

      const sessionCurrentPlayer = gameState.players[gameState.currentPlayerIndex];
      if (sessionCurrentPlayer?.userId !== remoteUserId) return;

      const applied = applyChallengeTurn(
        gameState.gameSlug,
        gameState.config,
        gameState.players.map((player) => ({
          gameState: player.gameState,
          currentScore: player.currentScore,
        })),
        gameState.currentPlayerIndex,
        darts,
      );

      const winnerGamePlayerId =
        applied.isComplete && applied.winnerIndex !== undefined
          ? applied.winnerIndex !== null
            ? gameState.players[applied.winnerIndex].id
            : null
          : undefined;

      await finishTurn(
        darts,
        applied.scoreDelta,
        applied.newState,
        applied.newScore,
        applied.isComplete,
        winnerGamePlayerId,
        undefined,
        undefined,
        true,
      );
    },
    [finishTurn, gameState, isProcessing],
  );

  useEffect(() => {
    if (isProcessing || !gameState) return;
    const next = pendingRemoteTurnsRef.current.shift();
    if (next) {
      void applyRemoteTurn(next.darts, next.remoteUserId, next.localUserId);
    }
  }, [isProcessing, gameState, applyRemoteTurn]);

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

      // Any new throw supersedes a pending missed-checkout prompt.
      setMissedCheckout(null);

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
        const turnId = await finishTurn(
          newDarts,
          result.scoreDelta,
          result.newState,
          newScore,
          result.isComplete,
        );

        // Eligible for the exact-tracking chip: a missed checkout-range turn
        // where no double was thrown (so we have no ground-truth attempt).
        if (
          turnId != null &&
          !result.isComplete &&
          isMissedCheckoutCandidate(startState.remaining, newDarts)
        ) {
          setMissedCheckout({ turnId });
        }
      }
    },
    [finishTurn, gameState, turnDarts, localX01State, isProcessing],
  );

  const recordIntendedTarget = useCallback(
    async (double: number) => {
      const pending = missedCheckout;
      if (!pending) return;
      setMissedCheckout(null);
      try {
        await db
          .update(gameTurns)
          .set({ intendedTarget: double })
          .where(eq(gameTurns.id, pending.turnId));
      } catch (error) {
        console.error('Failed to record intended target:', error);
      }
    },
    [missedCheckout],
  );

  const dismissMissedCheckout = useCallback(() => setMissedCheckout(null), []);

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

      if (!isShanghai && !isBaseball && !isHighScore && !isHalveIt && !isBobs27 && !isBermudaTriangle) {
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
      } else if (isBermudaTriangle) {
        const allStates = gameState.players.map(
          (p) => p.gameState as BermudaTrianglePlayerState,
        );
        const result = processBermudaTriangleTurn(
          newDarts,
          currentPlayer.gameState as BermudaTrianglePlayerState,
          allStates,
          idx,
        );
        isComplete = result.isComplete;
        scoreDelta = result.scoreDelta;
        newPlayerState = result.newState;
        newScore = result.newState.totalScore;
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
      isBermudaTriangle,
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
            if (onQuitConfirmed) {
              try {
                await onQuitConfirmed();
              } catch (error) {
                console.error('Failed to notify quit:', error);
                Alert.alert(
                  'Error',
                  'Could not leave the match. Check your connection and try again.',
                );
                return;
              }
            }
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
  }, [gameState, router, onQuitConfirmed]);

  const undoLastDart = useCallback(() => {
    if (!gameState || isProcessing || turnDarts.length === 0) return;

    const newDarts = turnDarts.slice(0, -1);
    setTurnDarts(newDarts);

    const currentPlayer = gameState.players[gameState.currentPlayerIndex];

    if (isAroundTheClock) {
      const startTarget = (currentPlayer.gameState as AroundTheClockPlayerState)
        .currentTarget;
      let target = startTarget;
      for (const d of newDarts) {
        if (d.segment === getTargetSegment(target) && d.multiplier > 0) {
          target += 1;
        }
      }
      setLocalTarget(target);
    } else if (isCricket) {
      const startState = currentPlayer.gameState as CricketPlayerState;
      if (newDarts.length === 0) {
        setLocalCricketState(startState);
      } else {
        const allPlayerStates = gameState.players.map(
          (player) => player.gameState as CricketPlayerState,
        );
        const result = processCricketTurn(
          newDarts,
          startState,
          allPlayerStates,
          gameState.currentPlayerIndex,
          gameState.config as CricketConfig,
        );
        setLocalCricketState(result.newState);
      }
    } else if (isX01) {
      const startState = currentPlayer.gameState as X01PlayerState;
      if (newDarts.length === 0) {
        setLocalX01State(startState);
      } else {
        const result = processX01Turn(
          newDarts,
          startState,
          gameState.config as X01Config,
        );
        setLocalX01State(result.newState);
      }
    }
  }, [gameState, isProcessing, turnDarts, isAroundTheClock, isCricket, isX01]);

  const handleKillerDartThrown = useCallback(
    async (dart: DartThrow) => {
      if (!gameState || isProcessing) return;

      const newDarts = [...turnDarts, dart];
      setTurnDarts(newDarts);

      const idx = gameState.currentPlayerIndex;
      const allStates = gameState.players.map((p) => p.gameState as KillerPlayerState);
      const phase = deriveKillerPhase(allStates);

      const takenNumbers = new Set(
        allStates.filter((s) => s.assignedNumber !== null).map((s) => s.assignedNumber as number),
      );

      const assignPhaseComplete =
        phase === 'assign' &&
        (dart.segment >= 1 &&
          dart.segment <= 20 &&
          !takenNumbers.has(dart.segment));

      const shouldSubmit =
        phase === 'play'
          ? newDarts.length === 3
          : assignPhaseComplete || newDarts.length === 3;

      if (!shouldSubmit) return;

      const result = processKillerTurn(newDarts, allStates, idx, takenNumbers);
      const updatedStates = result.updatedPlayerStates;

      const currentUpdated = updatedStates[idx];
      const additionalUpdates = updatedStates
        .map((s, i) => ({ index: i, state: s }))
        .filter(({ index }) => index !== idx)
        .map(({ index, state }) => ({
          gamePlayerId: gameState.players[index].id,
          newState: state,
          newScore: state.lives,
        }));

      const winnerGamePlayerId =
        result.isComplete
          ? result.winnerIndex !== null
            ? gameState.players[result.winnerIndex].id
            : null
          : undefined;

      const nextIdx = result.isComplete
        ? undefined
        : getKillerNextPlayerIndex(updatedStates, idx);

      await finishTurn(
        newDarts,
        result.scoreDelta,
        currentUpdated,
        currentUpdated.lives,
        result.isComplete,
        winnerGamePlayerId,
        additionalUpdates,
        nextIdx,
      );
    },
    [finishTurn, gameState, turnDarts, isProcessing],
  );

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

    finishTurn(
      misses,
      result.scoreDelta,
      result.newState,
      result.newState.score,
      result.isComplete,
      winnerGamePlayerId,
    ).catch(() => {
      bobs27AutoSubmitRef.current = null;
    });
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
    isBermudaTriangle,
    isKiller,
    localTarget,
    localCricketState,
    localX01State,
    handleATCDartThrown,
    handleCricketDartThrown,
    handleX01DartThrown,
    handleRoundDartThrown,
    handleKillerDartThrown,
    undoLastDart,
    handleQuit,
    isX01,
    applyRemoteTurn,
    missedCheckout,
    recordIntendedTarget,
    dismissMissedCheckout,
  };
}
