export type FriendStatus = 'online' | 'in_match' | 'offline';

export interface UserProfile {
  id: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  username: string | null;
}

export interface Friend extends UserProfile {
  friendshipId: string;
  status: FriendStatus;
  threeDartAvg: number | null;
}

export interface FriendRequest {
  id: string;
  requester: UserProfile;
  createdAt: string;
}

export type ClubRole = 'admin' | 'member';

export interface Club {
  id: string;
  name: string;
  description: string | null;
  createdBy: string;
  role: ClubRole;
}

export interface ClubMember extends UserProfile {
  membershipId: string;
  role: ClubRole;
  joinedAt: string;
}

export interface ClubInvite {
  id: string;
  clubId: string;
  invitedBy: string;
  inviteeId: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
}

export interface ClubLeaderboardRow {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  gamesPlayed: number;
  avgThreeDartAvg: number | null;
}

export type PresenceMap = Record<string, FriendStatus>;

export interface ContactPlayer {
  userId: string;
  displayName: string;
  username: string | null;
}

export type ReactionType = 'thumbs_up' | 'bullseye' | 'fire' | 'thumbs_down';

export interface ReactionRow {
  userId: string;
  type: ReactionType;
}

export interface AggregatedReactions {
  thumbs_up: number;
  bullseye: number;
  fire: number;
  thumbs_down: number;
  myReactions: ReactionType[];
}

export interface ReactorUser {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  reactionType: ReactionType;
}

export interface PostAuthor {
  id: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  avatarUrl: string | null;
}

export interface GameCard {
  gameSlug: string;
  threeDartAvg: number | null;
}

export interface ClubPost {
  id: string;
  clubId: string;
  author: PostAuthor;
  body: string;
  gameCard: GameCard | null;
  reactions: AggregatedReactions;
  commentCount: number;
  createdAt: string;
}

export interface ClubPostComment {
  id: string;
  postId: string;
  parentCommentId: string | null;
  author: PostAuthor;
  body: string;
  createdAt: string;
  reactions: AggregatedReactions;
}

export interface FeedPage {
  items: ClubPost[];
  nextCursor: string | null;
}

export interface CommentsPage {
  items: ClubPostComment[];
  nextCursor: string | null;
}

export interface RecentGame {
  id: string;
  gameSlug: string;
  completedAt: string;
  isWinner: boolean;
  threeDartAvg: number | null;
}

export interface MutualClub {
  id: string;
  name: string;
}

export interface FriendActivityItem {
  sessionId: string;
  author: PostAuthor;
  gameSlug: string;
  completedAt: string;
  isWinner: boolean;
  threeDartAvg: number | null;
}

export interface ActivityPage {
  items: FriendActivityItem[];
  nextCursor: string | null;
}
