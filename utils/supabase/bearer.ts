import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * A Supabase client scoped to a caller's access token.
 *
 * The website's own requests carry their session in a cookie, which
 * `utils/supabase/server` reads. The mobile app has no cookie — it holds a
 * Supabase session and sends the access token in an `Authorization` header, so
 * its requests need a client that authenticates that way. Queries made through
 * it run as that user, so RLS and `auth.uid()` behave exactly as they do on the
 * website.
 */
export function createBearerClient(accessToken: string): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );
}

/** The bearer token on a request, if it carries one. */
export function bearerTokenFrom(req: Request): string | null {
  const header = req.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}
