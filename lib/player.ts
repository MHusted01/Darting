import { DEFAULT_AVATAR_COLOR } from '@/constants/avatarColors';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { players } from '@/db/schema';


export async function getOrCreateUserPlayer(
  clerkUserId: string,
  displayName: string,
): Promise<{ id: number; name: string; avatarColor: string }> {
  const [row] = await db
    .insert(players)
    .values({ name: displayName, userId: clerkUserId, avatarColor: DEFAULT_AVATAR_COLOR })
    .onConflictDoUpdate({ target: players.userId, set: { name: displayName } })
    .returning();
  return { id: row.id, name: row.name, avatarColor: row.avatarColor };
}

export async function getUserPlayerId(clerkUserId: string): Promise<number | null> {
  const row = await db.query.players.findFirst({
    where: eq(players.userId, clerkUserId),
    columns: { id: true },
  });
  return row?.id ?? null;
}
