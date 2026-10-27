import posthog from "posthog-js";
import { readSignupContext } from "@/lib/signupContext";

export { rememberSignupContext } from "@/lib/signupContext";

let _initialized = false;

export function initAnalytics() {
  if (typeof window === "undefined") return;
  if (_initialized) return;
  _initialized = true;

  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    person_profiles: "identified_only",
    capture_pageview: false, // handled manually via PostHogPageView
    capture_pageleave: true,
  });
}

export function identifyUser(
  userId: string,
  props?: Record<string, string | null>,
  setOnce?: Record<string, string | null>
) {
  posthog.identify(userId, props ?? undefined, setOnce ?? undefined);
}

export function resetUser() {
  posthog.reset();
}

// ── Typed event helpers (mirrors noriuto-app/lib/analytics.ts) ───────────────

/**
 * Identifies the new account first, so `sign_up` and its `$set_once` land on
 * the person rather than an anonymous visitor (email sign-ups aren't signed
 * in until they confirm, so nothing else would identify them yet).
 */
export function trackSignUp(
  method: "google" | "email",
  userId?: string | null,
  email?: string | null
) {
  const ctx = readSignupContext();
  if (userId) identifyUser(userId, { email: email ?? null }, ctx);
  posthog.capture("sign_up", { method, ...ctx, $set_once: ctx });
}

export function trackSignIn(method: "google" | "email", userId?: string | null) {
  if (userId) identifyUser(userId);
  // Sent right away: sign-in is followed by a full page navigation, which can
  // drop a batched event.
  posthog.capture("sign_in", { method }, { send_instantly: true });
}

export type WishSource = "link" | "manual" | "inspo" | "share";

export function trackWishCreated(props: {
  source: WishSource;
  boardId: string;
  hasUrl: boolean;
  hasImage: boolean;
  hasPrice: boolean;
}) {
  posthog.capture("wish_created", {
    source: props.source,
    board_id: props.boardId,
    hasUrl: props.hasUrl,
    hasImage: props.hasImage,
    hasPrice: props.hasPrice,
  });
}

/** A list's link left the site. `channel` matches the app's board_shared method. */
export function trackListShared(props: {
  boardId: string;
  channel: "public_link" | "magic_link";
  itemsCount: number | null;
}) {
  posthog.capture("list_shared", {
    board_id: props.boardId,
    channel: props.channel,
    items_count: props.itemsCount,
  });
}

export type ViewerRole = "owner" | "signed_in" | "anonymous";

/** A shared list was opened (/b/<slug>, /b/s/<token>, a profile's board). */
export function trackListViewed(props: { boardId: string; viewerRole: ViewerRole }) {
  posthog.capture("list_viewed", {
    board_id: props.boardId,
    viewer_role: props.viewerRole,
  });
}

/** The giver's side of a reservation; the owner's side comes from the database. */
export function trackItemReserved(props: {
  boardId: string;
  ownerId: string | null;
  isGuest: boolean;
}) {
  posthog.capture("item_reserved", {
    board_id: props.boardId,
    owner_id: props.ownerId,
    is_guest: props.isGuest,
  });
}

export function trackEventCreated(type: string) {
  posthog.capture("event_created", { type });
}

export function trackInviteSent() {
  posthog.capture("invite_sent");
}

export function trackDrawCompleted(memberCount: number) {
  posthog.capture("draw_completed", { member_count: memberCount });
}

export function trackProfileUpdated() {
  posthog.capture("profile_updated");
}
