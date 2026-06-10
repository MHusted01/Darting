import { describe, expect, it } from '@jest/globals';
import {
  generateKnockoutBracket,
  advanceKnockoutWinners,
  generateRoundRobinPairings,
  calculateStandings,
  mapTournamentRow,
} from '@/lib/tournament';
import type { TournamentParticipant, TournamentMatch } from '@/types/tournament';

function makeParticipant(id: string, seeding?: number): TournamentParticipant {
  return {
    id,
    tournamentId: 't1',
    user: { id: 'u' + id, firstName: 'Player', lastName: id, avatarUrl: null, username: null },
    clubId: null,
    seeding: seeding ?? null,
    status: 'active',
  };
}

function makeMatch(
  id: string,
  p1: TournamentParticipant | null,
  p2: TournamentParticipant | null,
  winner: TournamentParticipant | null,
  status: MatchStatus = 'completed',
): TournamentMatch {
  return { id, roundId: 'r1', participant1: p1, participant2: p2, winner, gameSessionId: null, status, createdAt: '2026-06-21T00:00:00Z' };
}

type MatchStatus = 'pending' | 'in_progress' | 'completed' | 'bye';

describe('generateKnockoutBracket', () => {
  it('pairs 4 seeded participants as 1v4 and 2v3', () => {
    const [p1, p2, p3, p4] = [1, 2, 3, 4].map(i => makeParticipant('p' + i, i));
    const matches = generateKnockoutBracket([p1, p2, p3, p4]);
    expect(matches).toHaveLength(2);
    expect(matches[0]).toMatchObject({ participant1Id: 'p1', participant2Id: 'p4', status: 'pending' });
    expect(matches[1]).toMatchObject({ participant1Id: 'p2', participant2Id: 'p3', status: 'pending' });
  });

  it('gives a bye to the top seed when participant count is odd (3 players)', () => {
    const [p1, p2, p3] = [1, 2, 3].map(i => makeParticipant('p' + i, i));
    const matches = generateKnockoutBracket([p1, p2, p3]);
    const bye = matches.find(m => m.status === 'bye');
    expect(bye).toBeDefined();
    expect(bye?.participant1Id).toBe('p1');
    expect(bye?.participant2Id).toBeNull();
    const play = matches.find(m => m.status === 'pending');
    expect(play).toBeDefined();
  });

  it('gives byes to top 3 seeds when 5 players', () => {
    const ps = [1, 2, 3, 4, 5].map(i => makeParticipant('p' + i, i));
    const matches = generateKnockoutBracket(ps);
    const byes = matches.filter(m => m.status === 'bye');
    expect(byes).toHaveLength(3);
    expect(byes.map(b => b.participant1Id)).toEqual(['p1', 'p2', 'p3']);
    const playing = matches.find(m => m.status === 'pending');
    expect(playing).toMatchObject({ participant1Id: 'p4', participant2Id: 'p5' });
  });

  it('returns empty array for fewer than 2 participants', () => {
    expect(generateKnockoutBracket([])).toHaveLength(0);
    expect(generateKnockoutBracket([makeParticipant('p1', 1)])).toHaveLength(0);
  });

  it('works with unseeded participants preserving input order', () => {
    const [p1, p2] = [makeParticipant('p1'), makeParticipant('p2')];
    const matches = generateKnockoutBracket([p1, p2]);
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({ participant1Id: 'p1', participant2Id: 'p2', status: 'pending' });
  });
});

describe('advanceKnockoutWinners', () => {
  it('pairs winners from completed matches', () => {
    const [p1, p2, p3, p4] = [1, 2, 3, 4].map(i => makeParticipant('p' + i, i));
    const matches = [
      makeMatch('m1', p1, p4, p1),
      makeMatch('m2', p2, p3, p2),
    ];
    const next = advanceKnockoutWinners(matches);
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ participant1Id: 'p1', participant2Id: 'p2', status: 'pending' });
  });

  it('advances bye participant as a winner', () => {
    const [p1, p2, p3] = [1, 2, 3].map(i => makeParticipant('p' + i, i));
    const matches = [
      makeMatch('m1', p1, null, null, 'bye'),
      makeMatch('m2', p2, p3, p2),
    ];
    const next = advanceKnockoutWinners(matches);
    expect(next).toHaveLength(1);
    expect(next[0].participant1Id).toBe('p1');
    expect(next[0].participant2Id).toBe('p2');
  });

  it('returns empty array when no completed or bye matches', () => {
    const [p1, p2] = [makeParticipant('p1'), makeParticipant('p2')];
    expect(advanceKnockoutWinners([makeMatch('m1', p1, p2, null, 'pending')])).toHaveLength(0);
  });

  it('returns empty when only one winner (odd resolved round)', () => {
    const p1 = makeParticipant('p1');
    expect(advanceKnockoutWinners([makeMatch('m1', p1, null, null, 'bye')])).toHaveLength(0);
  });
});

describe('generateRoundRobinPairings', () => {
  it('generates all unique pairs for 4 participants', () => {
    const ps = [1, 2, 3, 4].map(i => makeParticipant('p' + i));
    const matches = generateRoundRobinPairings(ps);
    expect(matches).toHaveLength(6);
    for (const m of matches) {
      expect(m.status).toBe('pending');
      expect(m.participant1Id).not.toBe(m.participant2Id);
    }
  });

  it('generates 1 match for 2 participants', () => {
    expect(generateRoundRobinPairings([makeParticipant('p1'), makeParticipant('p2')])).toHaveLength(1);
  });

  it('returns empty for fewer than 2 participants', () => {
    expect(generateRoundRobinPairings([])).toHaveLength(0);
    expect(generateRoundRobinPairings([makeParticipant('p1')])).toHaveLength(0);
  });

  it('does not produce duplicate pairs', () => {
    const ps = [1, 2, 3].map(i => makeParticipant('p' + i));
    const matches = generateRoundRobinPairings(ps);
    const pairs = matches.map(m => [m.participant1Id, m.participant2Id].sort().join(','));
    expect(new Set(pairs).size).toBe(matches.length);
  });
});

describe('calculateStandings', () => {
  it('awards 3 points for a win and 0 for a loss', () => {
    const [p1, p2] = [makeParticipant('p1'), makeParticipant('p2')];
    const standings = calculateStandings([makeMatch('m1', p1, p2, p1)], [p1, p2]);
    const r1 = standings.find(r => r.participant.id === 'p1')!;
    const r2 = standings.find(r => r.participant.id === 'p2')!;
    expect(r1.points).toBe(3);
    expect(r1.won).toBe(1);
    expect(r1.legDiff).toBe(1);
    expect(r2.points).toBe(0);
    expect(r2.lost).toBe(1);
    expect(r2.legDiff).toBe(-1);
  });

  it('awards 1 point each for a draw (null winner on completed match)', () => {
    const [p1, p2] = [makeParticipant('p1'), makeParticipant('p2')];
    const standings = calculateStandings([makeMatch('m1', p1, p2, null)], [p1, p2]);
    const r1 = standings.find(r => r.participant.id === 'p1')!;
    const r2 = standings.find(r => r.participant.id === 'p2')!;
    expect(r1.points).toBe(1);
    expect(r1.drawn).toBe(1);
    expect(r2.points).toBe(1);
    expect(r2.drawn).toBe(1);
  });

  it('sorts by points desc, then legDiff desc', () => {
    const [p1, p2, p3] = [makeParticipant('p1'), makeParticipant('p2'), makeParticipant('p3')];
    const matches = [
      makeMatch('m1', p1, p2, p1),
      makeMatch('m2', p1, p3, p1),
      makeMatch('m3', p2, p3, p2),
    ];
    const standings = calculateStandings(matches, [p1, p2, p3]);
    expect(standings[0].participant.id).toBe('p1');
    expect(standings[1].participant.id).toBe('p2');
    expect(standings[2].participant.id).toBe('p3');
  });

  it('skips pending matches', () => {
    const [p1, p2] = [makeParticipant('p1'), makeParticipant('p2')];
    const standings = calculateStandings([makeMatch('m1', p1, p2, null, 'pending')], [p1, p2]);
    expect(standings[0].played).toBe(0);
    expect(standings[1].played).toBe(0);
  });
});

describe('mapTournamentRow', () => {
  it('converts snake_case fields to camelCase', () => {
    const raw = {
      id: 't1',
      club_id: 'c1',
      division_id: null,
      created_by: 'u1',
      name: 'Spring Cup',
      format: 'cup',
      game_slug: 'x01',
      status: 'active',
      start_date: '2026-07-01T00:00:00Z',
      end_date: null,
      settings: { legsPerMatch: 3, doubleOut: true },
      participant_count: 8,
      created_at: '2026-06-21T00:00:00Z',
    };
    const t = mapTournamentRow(raw);
    expect(t.id).toBe('t1');
    expect(t.clubId).toBe('c1');
    expect(t.divisionId).toBeNull();
    expect(t.createdBy).toBe('u1');
    expect(t.gameSlug).toBe('x01');
    expect(t.participantCount).toBe(8);
    expect(t.settings.legsPerMatch).toBe(3);
  });

  it('defaults settings when missing', () => {
    const raw = {
      id: 't2', club_id: null, division_id: 'd1', created_by: 'u1',
      name: 'Test', format: 'league', game_slug: 'cricket', status: 'draft',
      start_date: null, end_date: null, settings: null as unknown as { legsPerMatch: number; doubleOut: boolean },
      participant_count: 0, created_at: '2026-06-21T00:00:00Z',
    };
    const t = mapTournamentRow(raw);
    expect(t.settings.legsPerMatch).toBe(1);
    expect(t.settings.doubleOut).toBe(false);
  });
});
