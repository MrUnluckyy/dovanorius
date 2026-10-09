import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

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
    // The events area moved from /secret-santa to /events (it now hosts all
    // event types, not just Secret Santa). Keep old links/bookmarks working.
    return [
      {
        source: "/secret-santa",
        destination: "/events",
        permanent: true,
      },
      {
        source: "/secret-santa/:path*",
        destination: "/events/:path*",
        permanent: true,
      },
    ];
  },
};
const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
