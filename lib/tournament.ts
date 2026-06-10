import type {
  Tournament,
  TournamentMatch,
  TournamentParticipant,
  LeagueStandingRow,
  MatchSpec,
  TournamentSettings,
  TournamentFormat,
  TournamentStatus,
} from '@/types/tournament';

export function generateKnockoutBracket(participants: TournamentParticipant[]): MatchSpec[] {
  if (participants.length < 2) return [];

  const sorted = [...participants].sort((a, b) => {
    if (a.seeding == null && b.seeding == null) return 0;
    if (a.seeding == null) return 1;
    if (b.seeding == null) return -1;
    return a.seeding - b.seeding;
  });

  let pow2 = 1;
  while (pow2 < sorted.length) pow2 *= 2;

  const numByes = pow2 - sorted.length;
  const byeSeeds = sorted.slice(0, numByes);
  const playing = sorted.slice(numByes);

  const matches: MatchSpec[] = byeSeeds.map(p => ({
    participant1Id: p.id,
    participant2Id: null,
    status: 'bye' as const,
  }));

  const queue = [...playing];
  while (queue.length >= 2) {
    const p1 = queue.shift()!;
    const p2 = queue.pop()!;
    matches.push({ participant1Id: p1.id, participant2Id: p2.id, status: 'pending' });
  }

  return matches;
}

export function advanceKnockoutWinners(completedMatches: TournamentMatch[]): MatchSpec[] {
  const winners = completedMatches
    .map(m => {
      if (m.status === 'bye') return m.participant1?.id ?? null;
      if (m.status === 'completed') return m.winner?.id ?? null;
      return null;
    })
    .filter((id): id is string => id !== null);

  const matches: MatchSpec[] = [];
  const queue = [...winners];
  while (queue.length >= 2) {
    const p1 = queue.shift()!;
    const p2 = queue.pop()!;
    matches.push({ participant1Id: p1, participant2Id: p2, status: 'pending' });
  }
  return matches;
}

export function generateRoundRobinPairings(participants: TournamentParticipant[]): MatchSpec[] {
  if (participants.length < 2) return [];
  const matches: MatchSpec[] = [];
  for (let i = 0; i < participants.length; i++) {
    for (let j = i + 1; j < participants.length; j++) {
      matches.push({ participant1Id: participants[i].id, participant2Id: participants[j].id, status: 'pending' });
    }
  }
  return matches;
}

export function calculateStandings(
  matches: TournamentMatch[],
  participants: TournamentParticipant[],
): LeagueStandingRow[] {
  const rowMap = new Map<string, LeagueStandingRow>();
  for (const p of participants) {
    rowMap.set(p.id, { participant: p, played: 0, won: 0, drawn: 0, lost: 0, points: 0, legDiff: 0 });
  }

  for (const m of matches) {
    if (m.status !== 'completed' || !m.participant1 || !m.participant2) continue;
    const r1 = rowMap.get(m.participant1.id);
    const r2 = rowMap.get(m.participant2.id);
    if (!r1 || !r2) continue;

    if (m.winner?.id === m.participant1.id) {
      rowMap.set(r1.participant.id, { ...r1, played: r1.played + 1, won: r1.won + 1, points: r1.points + 3, legDiff: r1.legDiff + 1 });
      rowMap.set(r2.participant.id, { ...r2, played: r2.played + 1, lost: r2.lost + 1, legDiff: r2.legDiff - 1 });
    } else if (m.winner?.id === m.participant2.id) {
      rowMap.set(r2.participant.id, { ...r2, played: r2.played + 1, won: r2.won + 1, points: r2.points + 3, legDiff: r2.legDiff + 1 });
      rowMap.set(r1.participant.id, { ...r1, played: r1.played + 1, lost: r1.lost + 1, legDiff: r1.legDiff - 1 });
    } else {
      rowMap.set(r1.participant.id, { ...r1, played: r1.played + 1, drawn: r1.drawn + 1, points: r1.points + 1 });
      rowMap.set(r2.participant.id, { ...r2, played: r2.played + 1, drawn: r2.drawn + 1, points: r2.points + 1 });
    }
  }

  return Array.from(rowMap.values()).sort((a, b) =>
    b.points !== a.points ? b.points - a.points : b.legDiff - a.legDiff,
  );
}

export interface RawTournamentRow {
  id: string;
  club_id: string | null;
  division_id: string | null;
  created_by: string;
  name: string;
  format: string;
  game_slug: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  settings: TournamentSettings | null;
  participant_count: number;
  created_at: string;
}

export function mapTournamentRow(raw: RawTournamentRow): Tournament {
  return {
    id: raw.id,
    clubId: raw.club_id,
    divisionId: raw.division_id,
    createdBy: raw.created_by,
    name: raw.name,
    format: raw.format as TournamentFormat,
    gameSlug: raw.game_slug,
    status: raw.status as TournamentStatus,
    startDate: raw.start_date,
    endDate: raw.end_date,
    settings: raw.settings ?? { legsPerMatch: 1, doubleOut: false },
    participantCount: raw.participant_count ?? 0,
    createdAt: raw.created_at,
  };
}
