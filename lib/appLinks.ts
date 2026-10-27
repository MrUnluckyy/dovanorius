/**
 * Paths for links that leave the site — copied, shared, emailed — and that
 * the mobile app claims as universal/app links
 * (public/.well-known/apple-app-site-association: /b/*, /users/*,
 * /events/join/*).
 *
 * The web's own routes are Lithuanian (/zmones, /renginiai/prisijungti), and
 * the old English paths 308 to them (next.config.ts). Shared links still use
 * the English form on purpose: on a phone with Noriuto installed the OS opens
 * them in the app — which knows only those paths — and everywhere else the
 * redirect lands on the Lithuanian page. Switch these over once the app maps
 * the Lithuanian paths (app/+native-intent.ts) and the AASA lists them.
 */
export const shareLinks = {
  profile: (userId: string) => `/users/${userId}`,
  eventJoin: (token: string) => `/events/join/${token}`,
};

/**
 * Supabase only sends email links to allow-listed redirect URLs; this one has
 * been on the list since launch. It redirects on to the dashboard.
 */
export const AUTH_EMAIL_LANDING = "/dashboard";
