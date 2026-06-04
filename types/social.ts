export interface Club {
  id: string;
  name: string;
  league: string;
  nextMatch: string | null;
  isActive: boolean;
}

export type FriendStatus = 'online' | 'in_match' | 'offline';

export interface Friend {
  id: string;
  name: string;
  status: FriendStatus;
  activity: string;
  threeDartAvg: number;
}
