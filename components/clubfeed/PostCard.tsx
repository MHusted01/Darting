import { useState } from 'react';
import { DS_COLORS } from '@/constants/colors';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAddComment, useLatestComments, useSetCommentReaction } from '@/hooks/useClubFeed';
import { useClubMembers } from '@/hooks/useClubs';
import { getActiveMentionQuery, insertMention, parseMentions } from '@/lib/mentions';
import { timeAgo } from '@/lib/time';
import type { ClubMember, ClubPost, ClubPostComment, ReactionType } from '@/types/social';
import { CommentsModal } from './CommentsModal';
import { ReactionsModal } from './ReactionsModal';

const REACTION_LABELS: Record<ReactionType, string> = {
  thumbs_up: '👍',
  thumbs_down: '👎',
  bullseye: '🎯',
  fire: '🔥',
};
const REACTION_TYPES: ReactionType[] = ['thumbs_up', 'thumbs_down', 'bullseye', 'fire'];

interface PostCardProps {
  post: ClubPost;
  clubId: string;
  currentUserId: string;
  isAdmin: boolean;
  onReact: (postId: string, type: ReactionType, isActive: boolean) => void;
  onDelete: (postId: string) => void;
}

function renderBodyWithMentions(body: string, size: 'base' | 'sm' = 'base') {
  const textClass = `text-${size} font-barlow text-ds-on-surface`;
  const mentions = parseMentions(body);
  if (mentions.length === 0) {
    return <Text className={textClass}>{body}</Text>;
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
    <Text className={`${textClass} flex-row flex-wrap`}>{parts}</Text>
  );
}

function CommentReactionBar({ comment, postId, clubId, onLongPress }: {
  comment: ClubPostComment;
  postId: string;
  clubId: string;
  onLongPress?: () => void;
}) {
  const setReaction = useSetCommentReaction(postId, clubId);
  return (
    <View className="flex-row gap-1 mt-1 flex-wrap">
      {REACTION_TYPES.map((type) => {
        const count = comment.reactions[type];
        const isActive = comment.reactions.myReactions.includes(type);
        if (count === 0 && !isActive) {
          return (
            <Pressable
              key={type}
              accessibilityRole="button"
              accessibilityLabel={`React with ${REACTION_LABELS[type]}`}
              onPress={() => setReaction.mutate({ commentId: comment.id, type, isActive: false })}
              onLongPress={onLongPress}
              className="px-1.5 py-0.5 rounded-full bg-ds-surface-low active:opacity-70"
            >
              <Text className="text-xs">{REACTION_LABELS[type]}</Text>
            </Pressable>
          );
        }
        return (
          <Pressable
            key={type}
            accessibilityRole="button"
            accessibilityLabel={`${REACTION_LABELS[type]} ${count}`}
            accessibilityState={{ selected: isActive }}
            onPress={() => setReaction.mutate({ commentId: comment.id, type, isActive })}
            onLongPress={onLongPress}
            className={`flex-row items-center gap-1 px-2 py-0.5 rounded-full active:opacity-70 ${isActive ? 'bg-ds-red-container' : 'bg-ds-surface-low'}`}
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

function PreviewCommentRow({ comment, postId, clubId }: {
  comment: ClubPostComment;
  postId: string;
  clubId: string;
}) {
  const [showReactions, setShowReactions] = useState(false);
  const name = [comment.author.firstName, comment.author.lastName].filter(Boolean).join(' ') || comment.author.username || 'Unknown';
  return (
    <View className="flex-row items-start gap-2 py-1.5">
      <View className="w-6 h-6 rounded-full bg-ds-surface-container items-center justify-center mt-0.5 shrink-0">
        <Text className="text-xs font-barlow-semi text-ds-on-surface-variant">
          {(comment.author.firstName?.[0] ?? comment.author.username?.[0] ?? '?').toUpperCase()}
        </Text>
      </View>
      <View className="flex-1">
        <View className="flex-row items-center gap-2 mb-0.5">
          <Text className="text-xs font-barlow-semi text-ds-on-surface">{name}</Text>
          <Text className="text-xs font-barlow text-ds-outline">{timeAgo(comment.createdAt)}</Text>
        </View>
        {renderBodyWithMentions(comment.body, 'sm')}
        <CommentReactionBar comment={comment} postId={postId} clubId={clubId} onLongPress={() => setShowReactions(true)} />
      </View>
      <ReactionsModal
        visible={showReactions}
        target={{ kind: 'comment', commentId: comment.id }}
        onClose={() => setShowReactions(false)}
      />
    </View>
  );
}

function QuickCommentInput({ postId, clubId, currentUserId, onOpenFull }: {
  postId: string;
  clubId: string;
  currentUserId: string;
  onOpenFull: () => void;
}) {
  const [commentText, setCommentText] = useState('');
  const { data: members } = useClubMembers(clubId);
  const addComment = useAddComment(postId, clubId);

  const mentionQuery = getActiveMentionQuery(commentText);
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
    setCommentText((prev) => insertMention(prev, member.username!));
  }

  function handleSubmit() {
    if (!commentText.trim()) return;
    const text = commentText.trim();
    setCommentText('');
    addComment.mutate({ body: text }, {
      onError: (err) => {
        setCommentText(text);
        Alert.alert('Error', err.message);
      },
    });
  }

  return (
    <View>
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
                <Text className="text-xs font-barlow-semi text-ds-on-surface">{name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      <View className="flex-row items-center gap-2">
        <View className="w-6 h-6 rounded-full bg-ds-surface-container items-center justify-center shrink-0">
          <Text className="text-xs font-barlow-semi text-ds-on-surface-variant">
            {(currentUserId?.[0] ?? '?').toUpperCase()}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Write a comment"
          onPress={onOpenFull}
          className="flex-1 bg-ds-surface-low border border-ds-outline-variant rounded-full px-3 py-2 flex-row items-center"
        >
          <TextInput
            accessibilityLabel="Write a comment"
            className="flex-1 text-sm font-barlow text-ds-on-surface"
            placeholder="Add a comment…"
            placeholderTextColor={DS_COLORS.outline}
            value={commentText}
            onChangeText={setCommentText}
            onSubmitEditing={handleSubmit}
            returnKeyType="send"
            maxLength={500}
          />
          {commentText.trim().length > 0 && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send comment"
              onPress={handleSubmit}
              disabled={addComment.isPending}
              className="active:opacity-70 pl-2"
            >
              <Text className="text-sm font-barlow-semi text-ds-red">Send</Text>
            </Pressable>
          )}
        </Pressable>
      </View>
    </View>
  );
}

export function PostCard({ post, clubId, currentUserId, isAdmin, onReact, onDelete }: PostCardProps) {
  const router = useRouter();
  const [showAllComments, setShowAllComments] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const { data: latestComments } = useLatestComments(post.id);
  const previewComments: ClubPostComment[] = Array.isArray(latestComments) ? latestComments : [];
  const canDelete = post.author.id === currentUserId || isAdmin;
  const authorName = [post.author.firstName, post.author.lastName].filter(Boolean).join(' ') || post.author.username || 'Unknown';

  function handleDelete() {
    Alert.alert('Delete post', 'Delete this post?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete(post.id) },
    ]);
  }

  return (
    <View className="bg-ds-surface border border-ds-outline-variant rounded-xl mx-4 mb-3 overflow-hidden">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`View ${authorName}'s profile`}
          onPress={() => router.push(`/(protected)/friend/${post.author.id}`)}
          className="flex-row items-center gap-2 active:opacity-70"
        >
          <View className="w-8 h-8 rounded-full bg-ds-surface-container items-center justify-center">
            <Text className="text-xs font-barlow-semi text-ds-on-surface-variant">
              {(post.author.firstName?.[0] ?? post.author.username?.[0] ?? '?').toUpperCase()}
            </Text>
          </View>
          <View>
            <Text className="text-sm font-barlow-semi text-ds-on-surface">{authorName}</Text>
            <Text className="text-xs font-barlow text-ds-outline">{timeAgo(post.createdAt)}</Text>
          </View>
        </Pressable>
        {canDelete && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Delete post"
            onPress={handleDelete}
            className="active:opacity-70 px-2 py-1"
          >
            <Text className="text-xs font-barlow text-ds-outline">Delete</Text>
          </Pressable>
        )}
      </View>

      {/* Body */}
      <View className="px-4 pb-3">{renderBodyWithMentions(post.body)}</View>

      {/* Attached game */}
      {post.gameCard && (
        <View className="mx-4 mb-3 bg-ds-surface-low border border-ds-outline-variant rounded-lg px-3 py-2">
          <Text className="text-xs font-barlow-semi text-ds-on-surface-variant uppercase tracking-widest mb-1">
            Game result
          </Text>
          <Text className="text-sm font-barlow text-ds-on-surface">
            {post.gameCard.gameSlug}
            {post.gameCard.threeDartAvg != null ? ` · ${post.gameCard.threeDartAvg.toFixed(1)} avg` : ''}
          </Text>
        </View>
      )}

      {/* Reactions + comment count */}
      <View className="flex-row items-center border-t border-ds-outline-variant px-4 py-2 gap-2">
        {REACTION_TYPES.map((type) => {
          const count = post.reactions[type];
          const isActive = post.reactions.myReactions.includes(type);
          return (
            <Pressable
              key={type}
              accessibilityRole="button"
              accessibilityLabel={`${REACTION_LABELS[type]}${count > 0 ? ` ${count}` : ''}`}
              accessibilityState={{ selected: isActive }}
              onPress={() => onReact(post.id, type, isActive)}
              onLongPress={() => setShowReactions(true)}
              className={`flex-row items-center gap-1 px-2.5 py-1.5 rounded-full active:opacity-70 ${
                isActive ? 'bg-ds-red-container' : 'bg-ds-surface-low'
              }`}
            >
              <Text className="text-base">{REACTION_LABELS[type]}</Text>
              {count > 0 && (
                <Text className={`text-xs font-barlow-semi ${isActive ? 'text-ds-red' : 'text-ds-on-surface-variant'}`}>
                  {count}
                </Text>
              )}
            </Pressable>
          );
        })}
        {post.commentCount > 0 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`View all ${post.commentCount} comments`}
            onPress={() => setShowAllComments(true)}
            className="ml-auto active:opacity-70"
          >
            <Text className="text-xs font-barlow text-ds-outline">
              {post.commentCount} comment{post.commentCount === 1 ? '' : 's'}
            </Text>
          </Pressable>
        )}
      </View>

      {/* Comment preview (2 most recent) */}
      {previewComments.length > 0 && (
        <View className="px-4 pt-1 pb-0">
          {post.commentCount > previewComments.length && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`View all ${post.commentCount} comments`}
              onPress={() => setShowAllComments(true)}
              className="pb-1 active:opacity-70"
            >
              <Text className="text-xs font-barlow-semi text-ds-on-surface-variant">
                View all {post.commentCount} comments
              </Text>
            </Pressable>
          )}
          {previewComments.map((comment) => (
            <PreviewCommentRow
              key={comment.id}
              comment={comment}
              postId={post.id}
              clubId={clubId}
            />
          ))}
        </View>
      )}

      {/* Quick comment input */}
      <View className="px-4 py-3">
        <QuickCommentInput
          postId={post.id}
          clubId={clubId}
          currentUserId={currentUserId}
          onOpenFull={() => setShowAllComments(true)}
        />
      </View>

      {/* Full comments modal */}
      <CommentsModal
        visible={showAllComments}
        postId={post.id}
        clubId={clubId}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
        onClose={() => setShowAllComments(false)}
      />
      <ReactionsModal
        visible={showReactions}
        target={{ kind: 'post', postId: post.id }}
        onClose={() => setShowReactions(false)}
      />
    </View>
  );
}
