import {
  CHALLENGER_AVATAR_COLOR as CHALLENGER_COLOR,
  CHALLENGEE_AVATAR_COLOR as CHALLENGEE_COLOR,
} from '@/constants/avatarColors';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { gamePlayers, gameSessions, players } from '@/db/schema';
import { configFromChallengeSettings, initialStateForSlug } from '@/lib/realtime-game';
import type { GameChallenge } from '@/types/realtime';


async function ensurePlayer(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  clerkUserId: string,
  name: string,
  avatarColor: string,
): Promise<number> {
  const [row] = await tx
    .insert(players)
    .values({ name, userId: clerkUserId, avatarColor })
    .onConflictDoUpdate({ target: players.userId, set: { name } })
    .returning({ id: players.id });
  return row.id;
}

export async function createLocalChallengeSession(
  challenge: GameChallenge,
  myUserId: string,
): Promise<number> {
  const existing = await db.query.gameSessions.findFirst({
    where: eq(gameSessions.challengeId, challenge.id),
    columns: { id: true },
  });
  if (existing) return existing.id;

  const opponentUserId =
    myUserId === challenge.challengerId ? challenge.challengeeId : challenge.challengerId;
  const config = configFromChallengeSettings(challenge.gameSlug, challenge.settings);

  return db.transaction(async (tx) => {
    const challengerPlayerId = await ensurePlayer(
      tx,
      challenge.challengerId,
      challenge.challengerName,
      CHALLENGER_COLOR,
    );
    const challengeePlayerId = await ensurePlayer(
      tx,
      challenge.challengeeId,
      challenge.challengeeName,
      CHALLENGEE_COLOR,
    );

    const [session] = await tx
      .insert(gameSessions)
      .values({
        gameSlug: challenge.gameSlug,
        status: 'in_progress',
        context: 'realtime',
        currentRound: 1,
        currentPlayerIndex: 0,
        config,
        startedAt: new Date(),
        challengeId: challenge.id,
        challengeOpponentUserId: opponentUserId,
      })
      .returning({ id: gameSessions.id });

    const orderedPlayerIds = [challengerPlayerId, challengeePlayerId];
    for (let i = 0; i < orderedPlayerIds.length; i++) {
      await tx.insert(gamePlayers).values({
        gameSessionId: session.id,
        playerId: orderedPlayerIds[i],
        playerOrder: i,
        currentScore: 0,
        gameState: initialStateForSlug(challenge.gameSlug, config) as Record<string, unknown>,
      });
    }

    return session.id;
  });
}
