import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/dashboard/",
        "/boards/",
        "/secret-santa/",
        "/login/",
        "/register/",
        "/forgot-password/",
        "/reset-password/",
        "/delete-account/",
        "/notifications/",
        "/api/",
      ],
    },
    sitemap: "https://www.noriuto.lt/sitemap.xml",
  };
}
