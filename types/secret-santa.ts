// types/secret-santa.ts
export type SsStatus = "draft" | "open" | "locked" | "drawn" | "archived";
export type SsRole = "owner" | "admin" | "member";
export type SsInviteStatus = "pending" | "accepted" | "declined" | "revoked";

export interface SsEvent {
  id: string;
  owner_id: string;
  name: string;
  budget: number | null;
  currency: string | null;
  event_date: string | null; // ISO date (YYYY-MM-DD)
  is_public: boolean;
  status: SsStatus;
  slug: string;
  notes: string | null;
  created_at: string; // ISO datetime
}

export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
}

export interface SsMember {
  id: string;
  event_id: string;
  user_id: string;
  display_name: string | null;
  role: SsRole;
  wants: string | null;
  address: string | null;
  is_confirmed: boolean;
  joined_at: string;
  profile?: Profile | null; // when selected with join alias
}

export interface MyAssignmentRow {
  event_id: string;
  giver: string;
  receiver: string;
}

export interface RecipientResult {
  receiver: Profile;
}

export interface SsInvite {
  id: string;
  event_id: string;
  from_user: string;
  to_user: string;
  status: SsInviteStatus;
  created_at: string;
}

export interface NotificationRow {
  id: string;
  user_id: string;
  type: string;
  payload: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

export type Participant = {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  status: "joined" | "accepted" | "pending" | "declined";
  role: SsRole;
  joined_at: string; // optional if you want to show when
};
