/**
 * Paths for links that leave the site — copied, shared, emailed — and that
 * the mobile app claims as universal/app links
 * (public/.well-known/apple-app-site-association).
 *
 * Lithuanian, like the web's own routes. The app maps them to its own screens
 * (noriuto-app lib/webLinks.ts, since its PR #11); the AASA lists both these
 * and the old English paths, which links already sent still use.
 */
export const shareLinks = {
  profile: (userId: string) => `/zmones/${userId}`,
  eventJoin: (token: string) => `/renginiai/prisijungti/${token}`,
};

/**
 * Supabase only sends email links to allow-listed redirect URLs; this one has
 * been on the list since launch. It redirects on to the dashboard.
 */
export const AUTH_EMAIL_LANDING = "/dashboard";
