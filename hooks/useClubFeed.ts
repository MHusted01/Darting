import { useAuth } from '@clerk/expo';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addComment,
  createPost,
  deleteComment,
  deletePost,
  getClubFeedPage,
  getCommentReactions,
  getLatestPostComments,
  getPostComments,
  getPostReactions,
  removeCommentReaction,
  removeReaction,
  setCommentReaction,
  setReaction,
} from '@/lib/club-feed';
import { toggleReactionState } from '@/lib/reactions';
import { useSupabase } from '@/providers/SupabaseProvider';
import type { AggregatedReactions, ClubPost, CommentsPage, FeedPage, ReactionType } from '@/types/social';

const PAGE_SIZE = 20;

export function useClubFeed(clubId: string) {
  const supabase = useSupabase();

  return useInfiniteQuery({
    queryKey: ['club-feed', clubId],
    queryFn: ({ pageParam }) => getClubFeedPage(supabase, clubId, pageParam as string | null, PAGE_SIZE),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage: FeedPage) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(supabase && clubId),
    staleTime: 30_000,
  });
}

export function useCreatePost(clubId: string) {
  const supabase = useSupabase();
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { body: string; gameSessionId: string | null }) => {
      if (!userId) return Promise.reject(new Error('Not authenticated'));
      return createPost(supabase, { clubId, authorId: userId, body: params.body, gameSessionId: params.gameSessionId });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['club-feed', clubId] });
    },
  });
}

export function useDeletePost(clubId: string) {
  const supabase = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (postId: string) => deletePost(supabase, postId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['club-feed', clubId] });
    },
  });
}

export function usePostComments(postId: string) {
  const supabase = useSupabase();

  return useInfiniteQuery({
    queryKey: ['post-comments', postId],
    queryFn: ({ pageParam }) => getPostComments(supabase, postId, pageParam as string | null, 30),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(supabase && postId),
    staleTime: 30_000,
  });
}

export function useLatestComments(postId: string) {
  const supabase = useSupabase();

  return useQuery({
    queryKey: ['post-comments-preview', postId],
    queryFn: () => getLatestPostComments(supabase, postId),
    enabled: Boolean(supabase && postId),
    staleTime: 30_000,
  });
}

export function useAddComment(postId: string, clubId: string) {
  const supabase = useSupabase();
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ body, parentCommentId }: { body: string; parentCommentId?: string | null }) => {
      if (!userId) return Promise.reject(new Error('Not authenticated'));
      return addComment(supabase, { postId, authorId: userId, body, parentCommentId });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['post-comments', postId] });
      void queryClient.invalidateQueries({ queryKey: ['post-comments-preview', postId] });
      void queryClient.invalidateQueries({ queryKey: ['club-feed', clubId] });
    },
  });
}

export function useDeleteComment(postId: string, clubId: string) {
  const supabase = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (commentId: string) => deleteComment(supabase, commentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['post-comments', postId] });
      void queryClient.invalidateQueries({ queryKey: ['post-comments-preview', postId] });
      void queryClient.invalidateQueries({ queryKey: ['club-feed', clubId] });
    },
  });
}

export function useSetReaction(clubId: string) {
  const supabase = useSupabase();
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ postId, type, isActive }: { postId: string; type: ReactionType; isActive: boolean }) => {
      if (!userId) return Promise.reject(new Error('Not authenticated'));
      if (isActive) return removeReaction(supabase, postId, userId, type);
      return setReaction(supabase, postId, userId, type);
    },
    onMutate: async ({ postId, type, isActive }) => {
      await queryClient.cancelQueries({ queryKey: ['club-feed', clubId] });
      const previous = queryClient.getQueryData(['club-feed', clubId]);

      queryClient.setQueryData(['club-feed', clubId], (old: { pages: FeedPage[] } | undefined) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.map((post: ClubPost) => {
              if (post.id !== postId) return post;
              return { ...post, reactions: toggleReactionState(post.reactions, type, isActive) };
            }),
          })),
        };
      });

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['club-feed', clubId], context.previous);
      }
    },
    onSettled: (_data, _err, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['club-feed', clubId] });
      void queryClient.invalidateQueries({ queryKey: ['post-reactions', variables.postId] });
    },
  });
}

export function useSetCommentReaction(postId: string, clubId: string) {
  const supabase = useSupabase();
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ commentId, type, isActive }: { commentId: string; type: ReactionType; isActive: boolean }) => {
      if (!userId) return Promise.reject(new Error('Not authenticated'));
      if (isActive) return removeCommentReaction(supabase, commentId, userId, type);
      return setCommentReaction(supabase, commentId, userId, type);
    },
    onMutate: async ({ commentId, type, isActive }) => {
      await queryClient.cancelQueries({ queryKey: ['post-comments', postId] });
      await queryClient.cancelQueries({ queryKey: ['post-comments-preview', postId] });
      const previous = queryClient.getQueryData(['post-comments', postId]);
      const previousPreview = queryClient.getQueryData(['post-comments-preview', postId]);

      const updateReaction = (comment: { id: string; reactions: AggregatedReactions }) =>
        comment.id !== commentId
          ? comment
          : { ...comment, reactions: toggleReactionState(comment.reactions, type, isActive) };

      queryClient.setQueryData(['post-comments', postId], (old: { pages: CommentsPage[] } | undefined) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.map(updateReaction),
          })),
        };
      });

      queryClient.setQueryData(['post-comments-preview', postId], (old: { id: string; reactions: AggregatedReactions }[] | undefined) => {
        if (!old) return old;
        return old.map(updateReaction);
      });

      return { previous, previousPreview };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['post-comments', postId], context.previous);
      }
      if (context?.previousPreview) {
        queryClient.setQueryData(['post-comments-preview', postId], context.previousPreview);
      }
    },
    onSettled: (_data, _err, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['post-comments', postId] });
      void queryClient.invalidateQueries({ queryKey: ['post-comments-preview', postId] });
      void queryClient.invalidateQueries({ queryKey: ['comment-reactions', variables.commentId] });
    },
  });
}

export function usePostReactions(postId: string, enabled: boolean) {
  const supabase = useSupabase();
  return useQuery({
    queryKey: ['post-reactions', postId],
    queryFn: () => getPostReactions(supabase, postId),
    enabled: Boolean(supabase && postId && enabled),
    staleTime: 30_000,
  });
}

export function useCommentReactions(commentId: string, enabled: boolean) {
  const supabase = useSupabase();
  return useQuery({
    queryKey: ['comment-reactions', commentId],
    queryFn: () => getCommentReactions(supabase, commentId),
    enabled: Boolean(supabase && commentId && enabled),
    staleTime: 30_000,
  });
}
