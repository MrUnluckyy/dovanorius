import posthog from "posthog-js";

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
  props?: Record<string, string | null>
) {
  posthog.identify(userId, props ?? undefined);
}

export function resetUser() {
  posthog.reset();
}

// ── Typed event helpers (mirrors noriuto-app/lib/analytics.ts) ───────────────

export function trackSignUp(method: "google" | "email") {
  posthog.capture("sign_up", { method });
}

export function trackSignIn(method: "google" | "email") {
  posthog.capture("sign_in", { method });
}

export function trackWishCreated(props: {
  hasUrl: boolean;
  hasImage: boolean;
  hasPrice: boolean;
}) {
  posthog.capture("wish_created", props);
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
