"use client";
import { useEffect, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import { initAnalytics, identifyUser } from "@/lib/analytics";

function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const url =
      pathname + (searchParams.toString() ? `?${searchParams.toString()}` : "");
    posthog.capture("$pageview", { $current_url: url });
  }, [pathname, searchParams]);

  return null;
}

export function PostHogProvider({
  userId,
  userEmail,
}: {
  userId?: string | null;
  userEmail?: string | null;
}) {
  useEffect(() => {
    initAnalytics();
  }, []);

  useEffect(() => {
    if (userId) {
      identifyUser(userId, { email: userEmail ?? null });
    }
  }, [userId, userEmail]);

  return (
    <Suspense fallback={null}>
      <PageViewTracker />
    </Suspense>
  );
}
