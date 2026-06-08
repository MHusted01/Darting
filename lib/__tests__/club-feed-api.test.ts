/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, jest } from '@jest/globals';
import {
  addComment,
  createPost,
  deleteComment,
  deletePost,
  getClubFeedPage,
  getPostComments,
  removeReaction,
  setReaction,
} from '@/lib/club-feed';

const CLUB_ID = 'club-1';
const POST_ID = 'post-1';
const COMMENT_ID = 'comment-1';
const USER_ID = 'user-1';

function rpc(result: any): any {
  const m: any = jest.fn();
  m.mockResolvedValue(result);
  return m;
}
function fn(): any { return jest.fn() as any; }

describe('getClubFeedPage', () => {
  it('calls get_club_feed RPC with correct params', async () => {
    const mockRpc = rpc({ data: [], error: null });
    await getClubFeedPage({ rpc: mockRpc } as any, CLUB_ID, null, 20);
    expect(mockRpc).toHaveBeenCalledWith('get_club_feed', expect.objectContaining({ p_club_id: CLUB_ID, p_limit: 21 }));
  });

  it('returns empty page when no data', async () => {
    const mockRpc = rpc({ data: [], error: null });
    const result = await getClubFeedPage({ rpc: mockRpc } as any, CLUB_ID, null, 20);
    expect(result.items).toHaveLength(0);
    expect(result.nextCursor).toBeNull();
  });

  it('throws on RPC error', async () => {
    const mockRpc = rpc({ data: null, error: { message: 'fail' } });
    await expect(getClubFeedPage({ rpc: mockRpc } as any, CLUB_ID, null, 20)).rejects.toThrow('fail');
  });
});

describe('getPostComments', () => {
  it('calls get_post_comments RPC', async () => {
    const mockRpc = rpc({ data: [], error: null });
    await getPostComments({ rpc: mockRpc } as any, POST_ID, null, 30);
    expect(mockRpc).toHaveBeenCalledWith('get_post_comments', expect.objectContaining({ p_post_id: POST_ID }));
  });
});

describe('createPost', () => {
  it('inserts into club_posts', async () => {
    const singleFn = fn().mockResolvedValue({ data: null, error: null });
    const selectFn = fn().mockReturnValue({ single: singleFn });
    const insertFn = fn().mockReturnValue({ select: selectFn });
    const fromFn = fn().mockReturnValue({ insert: insertFn });
    await createPost({ from: fromFn } as any, { clubId: CLUB_ID, authorId: USER_ID, body: 'hello', gameSessionId: null }).catch(() => null);
    expect(fromFn).toHaveBeenCalledWith('club_posts');
  });
});

describe('deletePost', () => {
  it('deletes from club_posts by id', async () => {
    const eqFn = fn().mockResolvedValue({ error: null });
    const deleteFn = fn().mockReturnValue({ eq: eqFn });
    const fromFn = fn().mockReturnValue({ delete: deleteFn });
    await deletePost({ from: fromFn } as any, POST_ID);
    expect(fromFn).toHaveBeenCalledWith('club_posts');
    expect(eqFn).toHaveBeenCalledWith('id', POST_ID);
  });
});

describe('addComment', () => {
  it('inserts into club_post_comments', async () => {
    const singleFn = fn().mockResolvedValue({ data: null, error: null });
    const selectFn = fn().mockReturnValue({ single: singleFn });
    const insertFn = fn().mockReturnValue({ select: selectFn });
    const fromFn = fn().mockReturnValue({ insert: insertFn });
    await addComment({ from: fromFn } as any, { postId: POST_ID, authorId: USER_ID, body: 'nice' }).catch(() => null);
    expect(fromFn).toHaveBeenCalledWith('club_post_comments');
  });
});

describe('deleteComment', () => {
  it('deletes from club_post_comments by id', async () => {
    const eqFn = fn().mockResolvedValue({ error: null });
    const deleteFn = fn().mockReturnValue({ eq: eqFn });
    const fromFn = fn().mockReturnValue({ delete: deleteFn });
    await deleteComment({ from: fromFn } as any, COMMENT_ID);
    expect(fromFn).toHaveBeenCalledWith('club_post_comments');
    expect(eqFn).toHaveBeenCalledWith('id', COMMENT_ID);
  });
});

describe('setReaction', () => {
  it('inserts into club_post_reactions', async () => {
    const insertFn = fn().mockResolvedValue({ error: null });
    const fromFn = fn().mockReturnValue({ insert: insertFn });
    await setReaction({ from: fromFn } as any, POST_ID, USER_ID, 'thumbs_up');
    expect(fromFn).toHaveBeenCalledWith('club_post_reactions');
  });
});

describe('removeReaction', () => {
  it('deletes from club_post_reactions by post, user, and type', async () => {
    const eqFn3 = fn().mockResolvedValue({ error: null });
    const eqFn2 = fn().mockReturnValue({ eq: eqFn3 });
    const eqFn1 = fn().mockReturnValue({ eq: eqFn2 });
    const deleteFn = fn().mockReturnValue({ eq: eqFn1 });
    const fromFn = fn().mockReturnValue({ delete: deleteFn });
    await removeReaction({ from: fromFn } as any, POST_ID, USER_ID, 'thumbs_up');
    expect(fromFn).toHaveBeenCalledWith('club_post_reactions');
    expect(eqFn1).toHaveBeenCalledWith('post_id', POST_ID);
    expect(eqFn2).toHaveBeenCalledWith('user_id', USER_ID);
    expect(eqFn3).toHaveBeenCalledWith('type', 'thumbs_up');
  });
});
