import { useRef, useState } from 'react';
import Skeleton from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, MessageCircle } from 'lucide-react-native';
import { useAddComment, useDeleteComment, usePostComments, useSetCommentReaction } from '@/hooks/useClubFeed';
import { ReactionsModal } from './ReactionsModal';
import { useClubMembers } from '@/hooks/useClubs';
import { getActiveMentionQuery, insertMention, parseMentions } from '@/lib/mentions';
import { timeAgo } from '@/lib/time';
import type { ClubMember, ClubPostComment, ReactionType } from '@/types/social';

const REACTION_LABELS: Record<ReactionType, string> = {
  thumbs_up: '👍',
  thumbs_down: '👎',
  bullseye: '🎯',
  fire: '🔥',
};
const REACTION_TYPES: ReactionType[] = ['thumbs_up', 'thumbs_down', 'bullseye', 'fire'];

interface Props {
  visible: boolean;
  postId: string;
  clubId: string;
  currentUserId: string;
  isAdmin: boolean;
  onClose: () => void;
}

interface ReplyingTo {
  commentId: string;
  authorName: string;
  username: string | null;
}

function renderBodyWithMentions(body: string) {
  const mentions = parseMentions(body);
  if (mentions.length === 0) {
    return <Text className="text-sm font-barlow text-ds-on-surface">{body}</Text>;
  }
  const parts: React.ReactNode[] = [];
  let remaining = body;
  let key = 0;
  for (const handle of mentions) {
    const pattern = new RegExp(`((?:^|[^\\w@])@${handle})`, 'i');
    const match = pattern.exec(remaining);
    if (!match) continue;
    const prefix = remaining.slice(0, match.index);
    const afterAt = match[1].startsWith('@') ? '' : match[1][0];
    const atPart = match[1].replace(/^[^\w@]*/, '');
    if (prefix) parts.push(<Text key={key++}>{prefix}</Text>);
    if (afterAt) parts.push(<Text key={key++}>{afterAt}</Text>);
    parts.push(<Text key={key++} className="text-ds-red font-barlow-semi">{atPart}</Text>);
    remaining = remaining.slice(match.index + match[1].length);
  }
  if (remaining) parts.push(<Text key={key++}>{remaining}</Text>);
  return (
    <Text className="text-sm font-barlow text-ds-on-surface flex-row flex-wrap">{parts}</Text>
  );
}

function CommentReactions({ comment, postId, clubId, onLongPress }: {
  comment: ClubPostComment;
  postId: string;
  clubId: string;
  onLongPress?: () => void;
}) {
  const setReaction = useSetCommentReaction(postId, clubId);

  return (
    <View className="flex-row gap-1 mt-1.5 flex-wrap">
      {REACTION_TYPES.map((type) => {
        const count = comment.reactions[type];
        const isActive = comment.reactions.myReactions.includes(type);
        return (
          <Pressable
            key={type}
            accessibilityRole="button"
            accessibilityLabel={`${REACTION_LABELS[type]}${count > 0 ? ` ${count}` : ''}`}
            accessibilityState={{ selected: isActive }}
            onPress={() => setReaction.mutate({ commentId: comment.id, type, isActive })}
            onLongPress={onLongPress}
            className={`flex-row items-center gap-1 px-2 py-0.5 rounded-full active:opacity-70 ${
              isActive ? 'bg-ds-red-container' : 'bg-ds-surface-low'
            }`}
          >
            <Text className="text-xs">{REACTION_LABELS[type]}</Text>
            {count > 0 && (
              <Text className={`text-xs font-barlow-semi ${isActive ? 'text-ds-red' : 'text-ds-on-surface-variant'}`}>
                {count}
              </Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

function CommentItem({ comment, postId, clubId, currentUserId, isAdmin, isReply, onReply, onDelete }: {
  comment: ClubPostComment;
  postId: string;
  clubId: string;
  currentUserId: string;
  isAdmin: boolean;
  isReply: boolean;
  onReply: (target: ReplyingTo) => void;
  onDelete: (id: string) => void;
}) {
  const [showReactions, setShowReactions] = useState(false);
  const canDelete = comment.author.id === currentUserId || isAdmin;
  const authorName =
    [comment.author.firstName, comment.author.lastName].filter(Boolean).join(' ') ||
    comment.author.username ||
    'Unknown';

  return (
    <View className={`flex-row items-start gap-3 py-3 ${isReply ? 'pl-10' : 'px-4'} ${isReply ? 'pr-4' : ''}`}>
      <View className={`${isReply ? 'w-6 h-6' : 'w-8 h-8'} rounded-full bg-ds-surface-container items-center justify-center mt-0.5 shrink-0`}>
        <Text className={`${isReply ? 'text-xs' : 'text-sm'} font-barlow-semi text-ds-on-surface-variant`}>
          {(comment.author.firstName?.[0] ?? comment.author.username?.[0] ?? '?').toUpperCase()}
        </Text>
      </View>
      <View className="flex-1">
        <View className="flex-row items-center gap-2 flex-wrap mb-0.5">
          <Text className="text-sm font-barlow-semi text-ds-on-surface">{authorName}</Text>
          <Text className="text-xs font-barlow text-ds-outline">{timeAgo(comment.createdAt)}</Text>
          {canDelete && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Delete comment"
              onPress={() => Alert.alert('Delete comment', 'Delete this comment?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => onDelete(comment.id) },
              ])}
              className="ml-auto active:opacity-70"
            >
              <Text className="text-xs font-barlow text-ds-outline">Delete</Text>
            </Pressable>
          )}
        </View>
        {renderBodyWithMentions(comment.body)}
        <View className="flex-row items-center gap-3 mt-1 flex-wrap">
          <CommentReactions comment={comment} postId={postId} clubId={clubId} onLongPress={() => setShowReactions(true)} />
          {!isReply && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Reply to ${authorName}`}
              onPress={() => onReply({
                commentId: comment.id,
                authorName,
                username: comment.author.username,
              })}
              className="active:opacity-70"
            >
              <Text className="text-xs font-barlow-semi text-ds-on-surface-variant">Reply</Text>
            </Pressable>
          )}
        </View>
      </View>
      <ReactionsModal
        visible={showReactions}
        target={{ kind: 'comment', commentId: comment.id }}
        onClose={() => setShowReactions(false)}
      />
    </View>
  );
}

interface ThreadedComment {
  comment: ClubPostComment;
  replies: ClubPostComment[];
}

export function CommentsModal({ visible, postId, clubId, currentUserId, isAdmin, onClose }: Props) {
  const [body, setBody] = useState('');
  const [replyingTo, setReplyingTo] = useState<ReplyingTo | null>(null);
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());
  const inputRef = useRef<TextInput>(null);
  const insets = useSafeAreaInsets();

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = usePostComments(postId);
  const { data: members } = useClubMembers(clubId);
  const addComment = useAddComment(postId, clubId);
  const deleteComment = useDeleteComment(postId, clubId);

  const allComments = data?.pages.flatMap((p) => p.items) ?? [];

  const topLevel = allComments.filter((c) => c.parentCommentId === null);
  const repliesMap = new Map<string, ClubPostComment[]>();
  allComments.forEach((c) => {
    if (c.parentCommentId) {
      const existing = repliesMap.get(c.parentCommentId) ?? [];
      repliesMap.set(c.parentCommentId, [...existing, c]);
    }
  });
  const threads: ThreadedComment[] = topLevel.map((c) => ({
    comment: c,
    replies: repliesMap.get(c.id) ?? [],
  }));

  const mentionQuery = getActiveMentionQuery(body);
  const mentionSuggestions: ClubMember[] =
    mentionQuery !== null && Array.isArray(members)
      ? members.filter((m) => {
          if (!m.username || m.id === currentUserId) return false;
          if (mentionQuery === '') return true;
          const q = mentionQuery.toLowerCase();
          return (
            m.username.toLowerCase().startsWith(q) ||
            m.firstName?.toLowerCase().startsWith(q) ||
            m.lastName?.toLowerCase().startsWith(q)
          );
        })
      : [];

  function handleMentionSelect(member: ClubMember) {
    if (!member.username) return;
    setBody((prev) => insertMention(prev, member.username!));
  }

  function handleReply(target: ReplyingTo) {
    setReplyingTo(target);
    const prefix = target.username ? `@${target.username} ` : '';
    setBody(prefix);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function cancelReply() {
    setReplyingTo(null);
    setBody('');
  }

  function handleSubmit() {
    if (!body.trim()) return;
    const text = body.trim();
    const target = replyingTo;
    setBody('');
    setReplyingTo(null);
    addComment.mutate(
      { body: text, parentCommentId: target?.commentId ?? null },
      {
        onError: (err) => {
          setBody(text);
          setReplyingTo(target);
          Alert.alert('Error', err.message);
        },
      },
    );
  }

  function toggleThread(commentId: string) {
    setExpandedThreads((prev) => {
      const next = new Set(prev);
      if (next.has(commentId)) {
        next.delete(commentId);
      } else {
        next.add(commentId);
      }
      return next;
    });
  }

  function handleDelete(commentId: string) {
    deleteComment.mutate(commentId, {
      onError: (err) => Alert.alert('Error', err.message),
    });
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        className="flex-1 bg-ds-bg"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View className="flex-row items-center justify-between px-6 pt-6 pb-4 border-b border-ds-outline-variant">
          <Text className="text-xl font-barlow-condensed text-ds-on-surface">Comments</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close comments"
            onPress={onClose}
            className="active:opacity-70"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X size={22} color="#444748" />
          </Pressable>
        </View>

        <FlatList
          data={threads}
          keyExtractor={(item) => item.comment.id}
          renderItem={({ item }) => {
            const isExpanded = expandedThreads.has(item.comment.id);
            const sortedReplies = [...item.replies].sort(
              (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
            );
            const visibleReplies = isExpanded
              ? sortedReplies
              : sortedReplies.slice(-1);
            const hasHiddenReplies = sortedReplies.length > 1;
            return (
              <View className="border-b border-ds-outline-variant">
                <CommentItem
                  comment={item.comment}
                  postId={postId}
                  clubId={clubId}
                  currentUserId={currentUserId}
                  isAdmin={isAdmin}
                  isReply={false}
                  onReply={handleReply}
                  onDelete={handleDelete}
                />
                {visibleReplies.map((reply) => (
                  <CommentItem
                    key={reply.id}
                    comment={reply}
                    postId={postId}
                    clubId={clubId}
                    currentUserId={currentUserId}
                    isAdmin={isAdmin}
                    isReply={true}
                    onReply={handleReply}
                    onDelete={handleDelete}
                  />
                ))}
                {hasHiddenReplies && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={isExpanded ? 'Hide replies' : 'Show replies'}
                    onPress={() => toggleThread(item.comment.id)}
                    className="pl-10 pb-3 active:opacity-70"
                  >
                    <Text className="text-xs font-barlow-semi text-ds-on-surface-variant">
                      {isExpanded ? 'Hide replies' : 'Show replies'}
                    </Text>
                  </Pressable>
                )}
              </View>
            );
          }}
          onEndReached={() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage(); }}
          onEndReachedThreshold={0.3}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            isLoading ? (
              <View className="py-8 gap-2">
                <Skeleton className="h-12 w-full rounded-xl" />
                <Skeleton className="h-12 w-full rounded-xl" />
              </View>
            ) : (
              <EmptyState
                icon={MessageCircle}
                title="No comments yet"
                message="Be the first to comment."
              />
            )
          }
          ListFooterComponent={
            isFetchingNextPage
              ? <ActivityIndicator color="#ba1a1a" style={{ paddingVertical: 16 }} />
              : null
          }
        />

        <View className="border-t border-ds-outline-variant px-4 pt-2" style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
          {replyingTo && (
            <View className="flex-row items-center justify-between mb-2 px-1">
              <Text className="text-xs font-barlow text-ds-on-surface-variant">
                Replying to <Text className="font-barlow-semi text-ds-on-surface">{replyingTo.authorName}</Text>
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancel reply"
                onPress={cancelReply}
                className="active:opacity-70"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={14} color="#747878" />
              </Pressable>
            </View>
          )}

          {mentionSuggestions.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              className="mb-2"
              contentContainerStyle={{ gap: 6 }}
            >
              {mentionSuggestions.map((member) => {
                const name = [member.firstName, member.lastName].filter(Boolean).join(' ') || member.username || '';
                return (
                  <Pressable
                    key={member.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Mention ${name}`}
                    onPress={() => handleMentionSelect(member)}
                    className="bg-ds-surface border border-ds-outline-variant rounded-full px-3 py-1.5 flex-row items-center gap-1.5 active:opacity-70"
                  >
                    <View className="w-5 h-5 rounded-full bg-ds-surface-container items-center justify-center">
                      <Text className="text-xs font-barlow-semi text-ds-on-surface-variant">
                        {(member.firstName?.[0] ?? member.username?.[0] ?? '?').toUpperCase()}
                      </Text>
                    </View>
                    <View>
                      <Text className="text-xs font-barlow-semi text-ds-on-surface">{name}</Text>
                      {member.username && (
                        <Text className="text-xs font-barlow text-ds-outline">@{member.username}</Text>
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          <View className="flex-row items-center gap-3">
            <View className="flex-1 bg-ds-surface border border-ds-outline-variant rounded-xl px-4 py-2">
              <TextInput
                ref={inputRef}
                accessibilityLabel={replyingTo ? `Reply to ${replyingTo.authorName}` : 'Write a comment'}
                className="text-sm font-barlow text-ds-on-surface"
                placeholder={replyingTo ? `Reply to ${replyingTo.authorName}…` : 'Add a comment… type @ to mention'}
                placeholderTextColor="#747878"
                value={body}
                onChangeText={setBody}
                multiline
                maxLength={500}
              />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send"
              onPress={handleSubmit}
              disabled={!body.trim() || addComment.isPending}
              className={`rounded-xl px-4 py-3 items-center active:opacity-70 ${body.trim() ? 'bg-ds-red' : 'bg-ds-surface-container'} ${addComment.isPending ? 'opacity-50' : ''}`}
            >
              <Text className={`text-sm font-barlow-semi ${body.trim() ? 'text-white' : 'text-ds-outline'}`}>
                Send
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
