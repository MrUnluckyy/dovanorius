import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/siteUrl";
import { freshClient } from "@/sanity/client";
import { SITEMAP_FACETS_QUERY, SITEMAP_POSTS_QUERY } from "@/sanity/queries";

type SitemapPost = {
  slug: string;
  publishedAt?: string | null;
  _updatedAt?: string | null;
};

type SitemapFacet = { slug: string; lastModified?: string | null };

/** Re-read Sanity hourly; publishing a post shouldn't need a redeploy. */
export const revalidate = 3600;

/**
 * The sitemap `robots.txt` has been promising all along.
 *
 * `app/robots.ts` pointed crawlers at /sitemap.xml, which did not exist and
 * returned 404 — so the one signal a young site has for getting its pages
 * discovered was a dead link.
 *
 * Only genuinely public, indexable URLs belong here. Everything under
 * /dashboard, /boards, /events and the auth routes is disallowed in robots.txt,
 * /inspo is a redirect to /discover, and public user profiles are deliberately
 * left out: they are personal pages whose owners chose visibility for sharing,
 * not for search listing.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: absoluteUrl("/blog"), lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: absoluteUrl("/discover"), lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: absoluteUrl("/discover/browse"), lastModified: now, changeFrequency: "daily", priority: 0.6 },
    { url: absoluteUrl("/partneriams"), lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: absoluteUrl("/privatumo-politika"), changeFrequency: "yearly", priority: 0.1 },
    { url: absoluteUrl("/naudojimo-politika"), changeFrequency: "yearly", priority: 0.1 },
    { url: absoluteUrl("/slapuku-politika"), changeFrequency: "yearly", priority: 0.1 },
    { url: absoluteUrl("/atsakomybes-apribojimas"), changeFrequency: "yearly", priority: 0.1 },
  ];

  // Published content only — `freshClient` is pinned to the "published"
  // perspective, unlike the `sanityFetch` the pages use, which resolves drafts
  // whenever Next.js draft mode is on. A sitemap must never leak a draft URL.
  let posts: SitemapPost[] = [];
  let facets: SitemapFacet[] = [];
  try {
    [posts, facets] = await Promise.all([
      freshClient.fetch<SitemapPost[]>(SITEMAP_POSTS_QUERY),
      freshClient.fetch<SitemapFacet[]>(SITEMAP_FACETS_QUERY),
    ]);
  } catch (error) {
    // A Sanity hiccup should cost us the blog URLs, not the whole sitemap:
    // returning 500 here would put robots.txt back to pointing at a broken file.
    console.error("[sitemap] Sanity fetch failed", error);
  }

  const postRoutes: MetadataRoute.Sitemap = posts
    .filter((post) => Boolean(post.slug))
    .map((post) => ({
      url: absoluteUrl(`/blog/${post.slug}`),
      lastModified: new Date(post._updatedAt ?? post.publishedAt ?? now),
      changeFrequency: "monthly",
      priority: 0.7,
    }));

  const facetRoutes: MetadataRoute.Sitemap = facets
    .filter((facet) => Boolean(facet.slug))
    .map((facet) => ({
      url: absoluteUrl(`/blog/dovanos/${facet.slug}`),
      lastModified: new Date(facet.lastModified ?? now),
      changeFrequency: "weekly",
      priority: 0.6,
    }));

  return [...staticRoutes, ...postRoutes, ...facetRoutes];
}
