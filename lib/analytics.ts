import posthog from "posthog-js";
import { readSignupContext } from "@/lib/signupContext";
import { redactPayload } from "@/lib/analyticsRedact";

export { rememberSignupContext } from "@/lib/signupContext";

let _initialized = false;

/**
 * Start PostHog. Only called once the visitor has allowed analytics
 * (lib/consent.ts): until then PostHog is never loaded, so it stores nothing
 * on the device, and every capture below is a silent no-op.
 */
export function initAnalytics() {
  if (typeof window === "undefined") return;
  if (_initialized) {
    // Allowed again after withdrawing, in the same visit.
    if (posthog.has_opted_out_capturing()) {
      posthog.set_config({ disable_persistence: false });
      posthog.opt_in_capturing({ captureEventName: false });
    }
    return;
  }
  _initialized = true;

  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    person_profiles: "identified_only",
    capture_pageview: false, // handled manually via PostHogPageView
    capture_pageleave: true,
    // Every event, automatic ones included: auth links carry tokens in the URL.
    before_send: (event) => event && redactPayload(event),
  });
}

/** Analytics consent withdrawn: stop, and remove what analytics stored. */
export function disableAnalytics() {
  if (typeof window === "undefined") return;
  if (_initialized) {
    // Order matters: reset() rebuilds persistence and fetches flags, so it
    // goes first; then stop capturing and stop writing to the device.
    posthog.reset();
    posthog.opt_out_capturing();
    posthog.set_config({ disable_persistence: true });
  }
  for (const c of document.cookie.split("; ")) {
    const name = c.split("=")[0];
    // PostHog's, and Microsoft Clarity's first-party ones (its CLID cookie
    // lives on clarity.ms, out of our reach).
    if (name.startsWith("ph_") || name === "_clck" || name === "_clsk") {
      document.cookie = `${name}=; Max-Age=0; Path=/`;
      document.cookie = `${name}=; Max-Age=0; Path=/; Domain=.${location.hostname.replace(/^www\./, "")}`;
    }
  }
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("ph_") || key.startsWith("__ph_")) localStorage.removeItem(key);
    }
  } catch {
    // Storage can be blocked; nothing was stored then either.
  }
}

/** Whether PostHog is running; event helpers stay quiet when it is not. */
export function analyticsActive() {
  return _initialized && !posthog.has_opted_out_capturing();
}

/** PostHog, but silent until the visitor has allowed analytics. */
const ph = {
  capture: (...args: Parameters<typeof posthog.capture>) => {
    if (analyticsActive()) posthog.capture(...args);
  },
  identify: (...args: Parameters<typeof posthog.identify>) => {
    if (analyticsActive()) posthog.identify(...args);
  },
  reset: () => {
    if (analyticsActive()) posthog.reset();
  },
};

export function identifyUser(
  userId: string,
  props?: Record<string, string | null>,
  setOnce?: Record<string, string | null>
) {
  ph.identify(userId, props ?? undefined, setOnce ?? undefined);
}

export function resetUser() {
  ph.reset();
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
  ph.capture("sign_up", { method, ...ctx, $set_once: ctx });
}

export function trackSignIn(method: "google" | "email", userId?: string | null) {
  if (userId) identifyUser(userId);
  // Sent right away: sign-in is followed by a full page navigation, which can
  // drop a batched event.
  ph.capture("sign_in", { method }, { send_instantly: true });
}

export type WishSource = "link" | "manual" | "inspo" | "share";

export function trackWishCreated(props: {
  source: WishSource;
  boardId: string;
  hasUrl: boolean;
  hasImage: boolean;
  hasPrice: boolean;
}) {
  ph.capture("wish_created", {
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
  ph.capture("list_shared", {
    board_id: props.boardId,
    channel: props.channel,
    items_count: props.itemsCount,
  });
}

export type ViewerRole = "owner" | "signed_in" | "anonymous";

/** A shared list was opened (/b/<slug>, /b/s/<token>, a profile's board). */
export function trackListViewed(props: { boardId: string; viewerRole: ViewerRole }) {
  ph.capture("list_viewed", {
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
  ph.capture("item_reserved", {
    board_id: props.boardId,
    owner_id: props.ownerId,
    is_guest: props.isGuest,
  });
}

export function trackEventCreated(type: string) {
  ph.capture("event_created", { type });
}

export function trackInviteSent() {
  ph.capture("invite_sent");
}

export function trackDrawCompleted(memberCount: number) {
  ph.capture("draw_completed", { member_count: memberCount });
}

export function trackProfileUpdated() {
  ph.capture("profile_updated");
}
