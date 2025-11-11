// types/secret-santa.ts
export type SsStatus = "draft" | "open" | "locked" | "drawn" | "archived";
export type SsRole = "owner" | "admin" | "member";

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
