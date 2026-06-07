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
