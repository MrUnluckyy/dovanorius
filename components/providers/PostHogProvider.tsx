"use client";
import { useEffect, useState, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import { initAnalytics, identifyUser, disableAnalytics } from "@/lib/analytics";
import { CONSENT_CHANGED_EVENT, type Consent } from "@/lib/consent";

function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // A child's effects run before its parent's, so without this the first
    // page view of a visit reached PostHog before init and was dropped.
    // Only rendered with consent; initAnalytics is idempotent.
    initAnalytics();
    const url =
      pathname + (searchParams.toString() ? `?${searchParams.toString()}` : "");
    posthog.capture("$pageview", { $current_url: url });
  }, [pathname, searchParams]);

  return null;
}

/**
 * PostHog runs only with analytics consent. The root layout passes the choice
 * read from the cookie; the banner announces changes (CONSENT_CHANGED_EVENT),
 * which start or stop it without a reload.
 */
export function PostHogProvider({
  userId,
  userEmail,
  analyticsAllowed,
}: {
  userId?: string | null;
  userEmail?: string | null;
  analyticsAllowed: boolean;
}) {
  const [allowed, setAllowed] = useState(analyticsAllowed);

  useEffect(() => {
    const onChange = (e: Event) => setAllowed(!!(e as CustomEvent<Consent>).detail?.analytics);
    window.addEventListener(CONSENT_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(CONSENT_CHANGED_EVENT, onChange);
  }, []);

  useEffect(() => {
    if (allowed) initAnalytics();
    else disableAnalytics();
  }, [allowed]);

  useEffect(() => {
    if (allowed && userId) {
      identifyUser(userId, { email: userEmail ?? null });
    }
  }, [allowed, userId, userEmail]);

  if (!allowed) return null;
  return (
    <Suspense fallback={null}>
      <PageViewTracker />
    </Suspense>
  );
}
