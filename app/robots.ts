import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/siteUrl";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/mano/",
        "/lentos/",
        "/renginiai/",
        "/prisijungti/",
        "/registracija/",
        "/pamirsau-slaptazodi/",
        "/naujas-slaptazodis/",
        "/istrinti-paskyra/",
        "/notifications/",
        "/api/",
      ],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
