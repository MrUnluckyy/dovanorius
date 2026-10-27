/**
 * Sends one event to PostHog from the server, for moments no page is around to
 * report: the Google sign-in callback redirects before anything renders.
 *
 * Same project and host as the browser client, and `distinctId` is the
 * Supabase user id the browser identifies with, so the event joins the same
 * person. Bounded and silent: a slow or failing PostHog must never hold up or
 * break a sign-in.
 */
export async function captureServer(
  event: string,
  distinctId: string,
  properties: Record<string, unknown> = {}
): Promise<void> {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

  try {
    await fetch(`${host}/i/v0/e/`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        event,
        distinct_id: distinctId,
        properties: { ...properties, $lib: "noriuto-web-server" },
      }),
      signal: AbortSignal.timeout(2000),
    });
  } catch (err) {
    console.warn(`captureServer(${event}) failed:`, err);
  }
}
