import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/siteUrl";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/dashboard/",
        "/boards/",
        "/events/",
        "/login/",
        "/register/",
        "/forgot-password/",
        "/reset-password/",
        "/delete-account/",
        "/notifications/",
        "/api/",
      ],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
