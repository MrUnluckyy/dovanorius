// types/secret-santa.ts
export type SsStatus = "draft" | "open" | "locked" | "drawn" | "archived";
export type SsRole = "owner" | "admin" | "member";
export type SsInviteStatus = "pending" | "accepted" | "declined" | "revoked";
// Event kinds, shared with the noriuto mobile app. "group" (group gift) exists
// in the DB but its web UI is deferred — handled read-only for now.
export type SsEventType = "secret_santa" | "name_draw" | "group";

export interface SsEvent {
  id: string;
  owner_id: string;
  name: string;
  type: SsEventType;
  budget: number | null;
  currency: string | null;
  event_date: string | null; // ISO date (YYYY-MM-DD)
  is_public: boolean;
  status: SsStatus;
  slug: string;
  notes: string | null;
  cover_image_url: string | null;
  /** Bearer token behind the reusable "anyone with the link can join" URL. */
  join_token: string;
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

/** Row of `ss_event_invites` — an invitation addressed to an e-mail address
 *  rather than to an existing Noriuto account, plus the record of anyone who
 *  came in through the shared link. */
export interface SsEventInvite {
  id: string;
  event_id: string;
  email: string | null;
  display_name: string | null;
  token: string;
  invited_by: string | null;
  via_link: boolean;
  accepted_at: string | null;
  accepted_by: string | null;
  created_at: string;
}

/** Shape returned by the `get_ss_join_info` RPC, used by the join screen to
 *  describe the event before anyone commits to joining it. */
export interface SsJoinInfo {
  event_id: string;
  event_name: string;
  event_type: SsEventType;
  event_slug: string;
  event_date: string | null;
  budget: number | null;
  currency: string | null;
  cover_image_url: string | null;
  status: SsStatus;
  owner_name: string | null;
  member_count: number;
  already_used: boolean;
}
