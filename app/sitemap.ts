import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/siteUrl";
import { freshClient } from "@/sanity/client";
import { SITEMAP_FACETS_QUERY, SITEMAP_POSTS_QUERY } from "@/sanity/queries";
import { discoverHref } from "@/lib/discover/routes";
import { MIN_INDEXABLE_PRODUCTS, indexablePaths } from "@/lib/discover/seo";
import { initialGridFor } from "@/lib/discover/ssrGrid.server";

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
    { url: absoluteUrl("/idejos"), lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: absoluteUrl("/idejos/visos"), lastModified: now, changeFrequency: "daily", priority: 0.6 },
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

  return [...staticRoutes, ...(await giftPageRoutes(now)), ...postRoutes, ...facetRoutes];
}

/**
 * "Dovanos mamai", "Technikos dovanos vyrui"…: every recipient and category
 * page with enough products to be worth a search visit. Same rule and the
 * same (cached) first grid page as the page's own robots tag, so the sitemap
 * never lists a page that says noindex.
 */
async function giftPageRoutes(now: Date): Promise<MetadataRoute.Sitemap> {
  const paths = indexablePaths();
  const routes: MetadataRoute.Sitemap = [];
  // A few at a time: ~90 pages, and the database is a small instance.
  for (let i = 0; i < paths.length; i += 6) {
    const batch = await Promise.all(
      paths.slice(i, i + 6).map(async ({ recipient, category }) => {
        const grid = await initialGridFor(recipient, category, null);
        if (!grid || grid.products.length < MIN_INDEXABLE_PRODUCTS) return null;
        return {
          url: absoluteUrl(discoverHref(recipient, category)),
          lastModified: now,
          changeFrequency: "daily" as const,
          priority: category ? 0.6 : 0.7,
        };
      })
    );
    routes.push(...batch.filter((r) => r !== null));
  }
  return routes;
}
