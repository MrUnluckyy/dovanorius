import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { LEGACY_ROUTES } from "./lib/legacyRoutes";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      // Our own uploads (avatars, covers, wish images).
      { protocol: "https", hostname: "**.supabase.co" },
      // Google account avatars from Google OAuth sign-in (lh3–lh6...).
      { protocol: "https", hostname: "**.googleusercontent.com" },
      // Blog images served from the Sanity asset CDN.
      { protocol: "https", hostname: "cdn.sanity.io" },
    ],
    // Serve modern formats — much smaller than JPEG/PNG for the same quality.
    formats: ["image/avif", "image/webp"],
  },
  // The carousel renderer reads its fonts and the logo from disk at runtime;
  // file tracing cannot see a path built with process.cwd(), so name them.
  outputFileTracingIncludes: {
    "/admin/editorial/[id]/carousel/**": [
      "./lib/carousel/fonts/**",
      "./public/assets/logo.png",
    ],
  },
  async headers() {
    return [
      {
        // Apple reads this file as JSON; it has no extension, so say so.
        source: "/.well-known/apple-app-site-association",
        headers: [{ key: "Content-Type", value: "application/json" }],
      },
    ];
  },
  async redirects() {
    // The partner panel lives on its own host, where middleware rewrites
    // /login to /partner/login. Sending that /login to /prisijungti would
    // break partner sign-in, so the site's renames stay off that host.
    const notPartner = [{ type: "host" as const, value: "partner\\..*" }];

    return [
      // /events/<slug>/my is the one rename inside a dynamic segment.
      {
        source: "/events/:slug/my",
        destination: "/renginiai/:slug/mano",
        permanent: true,
        missing: notPartner,
      },
      ...LEGACY_ROUTES.flatMap(([from, to]) => [
        { source: from, destination: to, permanent: true, missing: notPartner },
        {
          source: `${from}/:path*`,
          destination: `${to}/:path*`,
          permanent: true,
          missing: notPartner,
        },
      ]),
    ];
  },
};
const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
