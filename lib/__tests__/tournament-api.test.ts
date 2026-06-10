/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, jest } from '@jest/globals';
import {
  createTournament,
  registerParticipant,
  completeTournamentMatch,
  getClubTournaments,
  updateTournamentStatus,
} from '@/lib/tournament-api';

const TOURNAMENT_ID = 'tournament-1';
const CLUB_ID = 'club-1';
const USER_ID = 'user-1';
const MATCH_ID = 'match-1';

function rpc(result: any): any {
  const m: any = jest.fn();
  m.mockResolvedValue(result);
  return m;
}
function fn(): any { return jest.fn() as any; }

describe('createTournament', () => {
  it('inserts into tournaments and returns the id', async () => {
    const singleFn = fn().mockResolvedValue({ data: { id: TOURNAMENT_ID }, error: null });
    const selectFn = fn().mockReturnValue({ single: singleFn });
    const insertFn = fn().mockReturnValue({ select: selectFn });
    const fromFn = fn().mockReturnValue({ insert: insertFn });
    const result = await createTournament({ from: fromFn } as any, {
      clubId: CLUB_ID, divisionId: null, createdBy: USER_ID,
      name: 'Test Cup', format: 'cup', gameSlug: 'x01',
      settings: { legsPerMatch: 1, doubleOut: true },
    });
    expect(fromFn).toHaveBeenCalledWith('tournaments');
    expect(result).toBe(TOURNAMENT_ID);
  });

  it('throws on insert error', async () => {
    const singleFn = fn().mockResolvedValue({ data: null, error: { message: 'fail' } });
    const selectFn = fn().mockReturnValue({ single: singleFn });
    const insertFn = fn().mockReturnValue({ select: selectFn });
    const fromFn = fn().mockReturnValue({ insert: insertFn });
    await expect(createTournament({ from: fromFn } as any, {
      clubId: CLUB_ID, divisionId: null, createdBy: USER_ID,
      name: 'Test Cup', format: 'cup', gameSlug: 'x01',
      settings: { legsPerMatch: 1, doubleOut: true },
    })).rejects.toThrow('fail');
  });
});

describe('registerParticipant', () => {
  it('inserts into tournament_participants', async () => {
    const insertFn = fn().mockResolvedValue({ error: null });
    const fromFn = fn().mockReturnValue({ insert: insertFn });
    await registerParticipant({ from: fromFn } as any, TOURNAMENT_ID, USER_ID);
    expect(fromFn).toHaveBeenCalledWith('tournament_participants');
  });

  it('throws on insert error', async () => {
    const insertFn = fn().mockResolvedValue({ error: { message: 'already registered' } });
    const fromFn = fn().mockReturnValue({ insert: insertFn });
    await expect(registerParticipant({ from: fromFn } as any, TOURNAMENT_ID, USER_ID))
      .rejects.toThrow('already registered');
  });
});

describe('completeTournamentMatch', () => {
  it('calls complete_tournament_match RPC with correct params', async () => {
    const mockRpc = rpc({ data: null, error: null });
    await completeTournamentMatch({ rpc: mockRpc } as any, MATCH_ID, 'participant-1', 'session-1');
    expect(mockRpc).toHaveBeenCalledWith('complete_tournament_match', expect.objectContaining({
      p_match_id: MATCH_ID,
      p_winner_id: 'participant-1',
      p_session_id: 'session-1',
    }));
  });

  it('throws on RPC error', async () => {
    const mockRpc = rpc({ data: null, error: { message: 'rpc fail' } });
    await expect(completeTournamentMatch({ rpc: mockRpc } as any, MATCH_ID, 'p1', 's1'))
      .rejects.toThrow('rpc fail');
  });
});

describe('getClubTournaments', () => {
  it('calls get_club_tournaments RPC with correct params', async () => {
    const mockRpc = rpc({ data: [], error: null });
    await getClubTournaments({ rpc: mockRpc } as any, CLUB_ID, null, 20);
    expect(mockRpc).toHaveBeenCalledWith('get_club_tournaments', expect.objectContaining({
      p_club_id: CLUB_ID,
      p_limit: 21,
    }));
  });

  it('returns empty page when no data', async () => {
    const mockRpc = rpc({ data: [], error: null });
    const result = await getClubTournaments({ rpc: mockRpc } as any, CLUB_ID, null, 20);
    expect(result.items).toHaveLength(0);
    expect(result.nextCursor).toBeNull();
  });

  it('throws on RPC error', async () => {
    const mockRpc = rpc({ data: null, error: { message: 'fail' } });
    await expect(getClubTournaments({ rpc: mockRpc } as any, CLUB_ID, null, 20))
      .rejects.toThrow('fail');
  });

  it('sets nextCursor when more items exist', async () => {
    const rows = Array.from({ length: 21 }, (_, i) => ({
      id: 't' + i, club_id: CLUB_ID, division_id: null, created_by: USER_ID,
      name: 'T' + i, format: 'cup', game_slug: 'x01', status: 'active',
      start_date: null, end_date: null, settings: { legsPerMatch: 1, doubleOut: false },
      participant_count: 0, created_at: '2026-06-21T00:00:00Z',
    }));
    const mockRpc = rpc({ data: rows, error: null });
    const result = await getClubTournaments({ rpc: mockRpc } as any, CLUB_ID, null, 20);
    expect(result.items).toHaveLength(20);
    expect(result.nextCursor).not.toBeNull();
  });
});

describe('updateTournamentStatus', () => {
  it('updates tournament status', async () => {
    const eqFn = fn().mockResolvedValue({ error: null });
    const updateFn = fn().mockReturnValue({ eq: eqFn });
    const fromFn = fn().mockReturnValue({ update: updateFn });
    await updateTournamentStatus({ from: fromFn } as any, TOURNAMENT_ID, 'active');
    expect(fromFn).toHaveBeenCalledWith('tournaments');
    expect(eqFn).toHaveBeenCalledWith('id', TOURNAMENT_ID);
  });

  it('throws on update error', async () => {
    const eqFn = fn().mockResolvedValue({ error: { message: 'update fail' } });
    const updateFn = fn().mockReturnValue({ eq: eqFn });
    const fromFn = fn().mockReturnValue({ update: updateFn });
    await expect(updateTournamentStatus({ from: fromFn } as any, TOURNAMENT_ID, 'active'))
      .rejects.toThrow('update fail');
  });
});
