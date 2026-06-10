/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, jest } from '@jest/globals';
import {
  acceptChallenge,
  abandonChallenge,
  cancelChallenge,
  createChallenge,
  declineChallenge,
  getChallenge,
  getLiveClubChallenges,
  listIncomingChallenges,
  startChallenge,
  submitTurnToServer,
  TurnRejectedError,
} from '@/lib/realtime-api';

const CHALLENGE_ID = 'challenge-1';
const CLUB_ID = 'club-1';
const USER_A = 'user-a';
const USER_B = 'user-b';

function fn(): any {
  return jest.fn() as any;
}

function challengeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: CHALLENGE_ID,
    challenger_id: USER_A,
    challengee_id: USER_B,
    game_slug: 'x01',
    settings: { startingScore: 501 },
    status: 'pending',
    current_turn_user_id: null,
    turn_count: 0,
    last_turn: null,
    winner_user_id: null,
    created_at: '2026-06-10T10:00:00Z',
    updated_at: '2026-06-10T10:00:00Z',
    challenger: { id: USER_A, first_name: 'Alice', last_name: 'Smith', username: 'alice' },
    challengee: { id: USER_B, first_name: 'Bob', last_name: 'Jones', username: 'bob' },
    ...overrides,
  };
}

describe('createChallenge', () => {
  it('inserts into game_challenges and returns the id', async () => {
    const singleFn = fn().mockResolvedValue({ data: { id: CHALLENGE_ID }, error: null });
    const selectFn = fn().mockReturnValue({ single: singleFn });
    const insertFn = fn().mockReturnValue({ select: selectFn });
    const fromFn = fn().mockReturnValue({ insert: insertFn });

    const result = await createChallenge({ from: fromFn } as any, {
      challengerId: USER_A,
      challengeeId: USER_B,
      gameSlug: 'x01',
      settings: { startingScore: 501 },
    });

    expect(fromFn).toHaveBeenCalledWith('game_challenges');
    expect(insertFn).toHaveBeenCalledWith({
      challenger_id: USER_A,
      challengee_id: USER_B,
      game_slug: 'x01',
      settings: { startingScore: 501 },
    });
    expect(result).toBe(CHALLENGE_ID);
  });

  it('throws on insert error', async () => {
    const singleFn = fn().mockResolvedValue({ data: null, error: { message: 'rls violation' } });
    const selectFn = fn().mockReturnValue({ single: singleFn });
    const insertFn = fn().mockReturnValue({ select: selectFn });
    const fromFn = fn().mockReturnValue({ insert: insertFn });

    await expect(
      createChallenge({ from: fromFn } as any, {
        challengerId: USER_A,
        challengeeId: USER_B,
        gameSlug: 'x01',
        settings: {},
      }),
    ).rejects.toThrow('rls violation');
  });
});

describe('getChallenge', () => {
  it('fetches and maps a challenge row', async () => {
    const singleFn = fn().mockResolvedValue({ data: challengeRow(), error: null });
    const eqFn = fn().mockReturnValue({ single: singleFn });
    const selectFn = fn().mockReturnValue({ eq: eqFn });
    const fromFn = fn().mockReturnValue({ select: selectFn });

    const challenge = await getChallenge({ from: fromFn } as any, CHALLENGE_ID);

    expect(fromFn).toHaveBeenCalledWith('game_challenges');
    expect(eqFn).toHaveBeenCalledWith('id', CHALLENGE_ID);
    expect(challenge).toMatchObject({
      id: CHALLENGE_ID,
      challengerId: USER_A,
      challengeeId: USER_B,
      gameSlug: 'x01',
      status: 'pending',
      turnCount: 0,
      challengerName: 'Alice Smith',
      challengeeName: 'Bob Jones',
    });
    expect(challenge.lastTurn).toBeNull();
  });

  it('maps a stored last_turn so a fetched challenge can replay the latest turn', async () => {
    const storedTurn = {
      challengeId: CHALLENGE_ID,
      turnSeq: 4,
      userId: USER_B,
      darts: [{ segment: 19, multiplier: 3 }],
      isComplete: false,
      winnerUserId: null,
      scores: { [USER_A]: 120, [USER_B]: 157 },
    };
    const singleFn = fn().mockResolvedValue({
      data: challengeRow({ status: 'in_progress', turn_count: 4, last_turn: storedTurn }),
      error: null,
    });
    const eqFn = fn().mockReturnValue({ single: singleFn });
    const selectFn = fn().mockReturnValue({ eq: eqFn });
    const fromFn = fn().mockReturnValue({ select: selectFn });

    const challenge = await getChallenge({ from: fromFn } as any, CHALLENGE_ID);

    expect(challenge.lastTurn).toEqual(storedTurn);
  });

  it('maps an unparseable last_turn to null', async () => {
    const singleFn = fn().mockResolvedValue({
      data: challengeRow({ last_turn: { bogus: true } }),
      error: null,
    });
    const eqFn = fn().mockReturnValue({ single: singleFn });
    const selectFn = fn().mockReturnValue({ eq: eqFn });
    const fromFn = fn().mockReturnValue({ select: selectFn });

    const challenge = await getChallenge({ from: fromFn } as any, CHALLENGE_ID);

    expect(challenge.lastTurn).toBeNull();
  });
});

describe('listIncomingChallenges', () => {
  it('queries pending challenges addressed to the user', async () => {
    const orderFn = fn().mockResolvedValue({ data: [challengeRow()], error: null });
    const gteFn = fn().mockReturnValue({ order: orderFn });
    const eqStatusFn = fn().mockReturnValue({ gte: gteFn });
    const eqUserFn = fn().mockReturnValue({ eq: eqStatusFn });
    const selectFn = fn().mockReturnValue({ eq: eqUserFn });
    const fromFn = fn().mockReturnValue({ select: selectFn });

    const result = await listIncomingChallenges({ from: fromFn } as any, USER_B);

    expect(fromFn).toHaveBeenCalledWith('game_challenges');
    expect(eqUserFn).toHaveBeenCalledWith('challengee_id', USER_B);
    expect(eqStatusFn).toHaveBeenCalledWith('status', 'pending');
    expect(result).toHaveLength(1);
    expect(result[0].challengerName).toBe('Alice Smith');
  });
});

describe('acceptChallenge', () => {
  function buildUpdateChain(data: unknown) {
    const selectFn = fn().mockResolvedValue({ data, error: null });
    const eqStatusFn = fn().mockReturnValue({ select: selectFn });
    const eqIdFn = fn().mockReturnValue({ eq: eqStatusFn });
    const updateFn = fn().mockReturnValue({ eq: eqIdFn });
    const fromFn = fn().mockReturnValue({ update: updateFn });
    return { fromFn, updateFn, eqIdFn, eqStatusFn };
  }

  it('returns true when the conditional update matches', async () => {
    const { fromFn, updateFn, eqIdFn, eqStatusFn } = buildUpdateChain([{ id: CHALLENGE_ID }]);

    const result = await acceptChallenge({ from: fromFn } as any, CHALLENGE_ID);

    expect(updateFn).toHaveBeenCalledWith({ status: 'accepted' });
    expect(eqIdFn).toHaveBeenCalledWith('id', CHALLENGE_ID);
    expect(eqStatusFn).toHaveBeenCalledWith('status', 'pending');
    expect(result).toBe(true);
  });

  it('returns false when the challenge was already cancelled (race)', async () => {
    const { fromFn } = buildUpdateChain([]);
    const result = await acceptChallenge({ from: fromFn } as any, CHALLENGE_ID);
    expect(result).toBe(false);
  });

  it('declineChallenge sets declined status', async () => {
    const { fromFn, updateFn } = buildUpdateChain([{ id: CHALLENGE_ID }]);
    const result = await declineChallenge({ from: fromFn } as any, CHALLENGE_ID);
    expect(updateFn).toHaveBeenCalledWith({ status: 'declined' });
    expect(result).toBe(true);
  });

  it('cancelChallenge sets cancelled status', async () => {
    const { fromFn, updateFn } = buildUpdateChain([{ id: CHALLENGE_ID }]);
    const result = await cancelChallenge({ from: fromFn } as any, CHALLENGE_ID);
    expect(updateFn).toHaveBeenCalledWith({ status: 'cancelled' });
    expect(result).toBe(true);
  });
});

describe('startChallenge / abandonChallenge', () => {
  it('startChallenge calls the RPC', async () => {
    const rpcFn = fn().mockResolvedValue({ data: null, error: null });
    await startChallenge({ rpc: rpcFn } as any, CHALLENGE_ID);
    expect(rpcFn).toHaveBeenCalledWith('start_challenge', { p_id: CHALLENGE_ID });
  });

  it('abandonChallenge calls the RPC', async () => {
    const rpcFn = fn().mockResolvedValue({ data: null, error: null });
    await abandonChallenge({ rpc: rpcFn } as any, CHALLENGE_ID);
    expect(rpcFn).toHaveBeenCalledWith('abandon_challenge', { p_id: CHALLENGE_ID });
  });

  it('throws on RPC error', async () => {
    const rpcFn = fn().mockResolvedValue({ data: null, error: { message: 'not accepted' } });
    await expect(startChallenge({ rpc: rpcFn } as any, CHALLENGE_ID)).rejects.toThrow('not accepted');
  });
});

describe('getLiveClubChallenges', () => {
  it('calls the RPC and maps rows', async () => {
    const rpcFn = fn().mockResolvedValue({
      data: [
        {
          id: CHALLENGE_ID,
          game_slug: 'x01',
          settings: {},
          challenger_id: USER_A,
          challenger_name: 'Alice Smith',
          challengee_id: USER_B,
          challengee_name: 'Bob Jones',
          turn_count: 4,
          created_at: '2026-06-10T10:00:00Z',
        },
      ],
      error: null,
    });

    const result = await getLiveClubChallenges({ rpc: rpcFn } as any, CLUB_ID);

    expect(rpcFn).toHaveBeenCalledWith('get_live_club_challenges', { p_club_id: CLUB_ID });
    expect(result).toEqual([
      {
        id: CHALLENGE_ID,
        gameSlug: 'x01',
        settings: {},
        challengerId: USER_A,
        challengerName: 'Alice Smith',
        challengeeId: USER_B,
        challengeeName: 'Bob Jones',
        turnCount: 4,
        createdAt: '2026-06-10T10:00:00Z',
      },
    ]);
  });
});

describe('submitTurnToServer', () => {
  const payload = {
    challengeId: CHALLENGE_ID,
    turnSeq: 1,
    userId: USER_A,
    darts: [{ segment: 20, multiplier: 3 }],
    isComplete: false,
    winnerUserId: null,
    scores: { [USER_A]: 60, [USER_B]: 0 },
  };

  it('invokes the validate-turn edge function with the payload', async () => {
    const invokeFn = fn().mockResolvedValue({ data: { ok: true }, error: null });
    await submitTurnToServer({ functions: { invoke: invokeFn } } as any, payload);
    expect(invokeFn).toHaveBeenCalledWith('validate-turn', { body: payload });
  });

  it('throws TurnRejectedError on a 409 rejection', async () => {
    const invokeFn = fn().mockResolvedValue({
      data: null,
      error: {
        name: 'FunctionsHttpError',
        context: {
          status: 409,
          json: fn().mockResolvedValue({ error: 'not_your_turn' }),
        },
      },
    });

    await expect(
      submitTurnToServer({ functions: { invoke: invokeFn } } as any, payload),
    ).rejects.toThrow(TurnRejectedError);
  });

  it('throws a generic error on other failures', async () => {
    const invokeFn = fn().mockResolvedValue({
      data: null,
      error: { name: 'FunctionsFetchError', message: 'network down' },
    });

    await expect(
      submitTurnToServer({ functions: { invoke: invokeFn } } as any, payload),
    ).rejects.toThrow('network down');
  });
});
