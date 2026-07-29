import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";

import FacetPills, { type Facet } from "@/components/blog/FacetPills";
import PostCard, { type PostCardData } from "@/components/blog/PostCard";
import { sanityFetch } from "@/sanity/live";
import {
  FEATURED_FACETS_QUERY,
  POSTS_COUNT_QUERY,
  POSTS_QUERY,
} from "@/sanity/queries";

const PAGE_SIZE = 12;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Blog");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: { canonical: "/blog" },
  };
}

export default async function BlogIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page } = await searchParams;
  const locale = await getLocale();
  const t = await getTranslations("Blog");

  const current = Math.max(1, Number(page) || 1);
  const start = (current - 1) * PAGE_SIZE;

  const [postsResult, countResult, facetsResult] = await Promise.all([
    sanityFetch({
      query: POSTS_QUERY,
      params: { locale, start, end: start + PAGE_SIZE },
      tags: ["post"],
    }),
    sanityFetch({ query: POSTS_COUNT_QUERY, tags: ["post"] }),
    sanityFetch({
      query: FEATURED_FACETS_QUERY,
      params: { locale },
      tags: ["giftFacet"],
    }),
  ]);

  const posts = (postsResult.data ?? []) as PostCardData[];
  const total = (countResult.data ?? 0) as number;
  const facets = (facetsResult.data ?? []) as Facet[];

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Only the first page leads with a hero story; deeper pages are a plain grid.
  const showFeatured = current === 1 && posts.length > 0;
  const featured = showFeatured ? posts[0] : null;
  const rest = showFeatured ? posts.slice(1) : posts;

  const facetLabels = {
    recipient: t("facetRecipient"),
    occasion: t("facetOccasion"),
    priceBand: t("facetPriceBand"),
  };

  return (
    <div className="mx-auto max-w-[1440px] px-4 sm:px-8">
      {/* Masthead */}
      <header className="border-base-300/60 border-b pt-10 pb-10 md:pt-14 md:pb-12">
        <div className="max-w-3xl">
          <p className="text-primary mb-3 text-xs font-semibold tracking-[0.18em] uppercase">
            {t("eyebrow")}
          </p>
          <h1 className="font-heading text-4xl leading-[1.05] font-bold text-balance md:text-6xl">
            {t("title")}
          </h1>
          <p className="text-base-content/65 mt-4 max-w-xl text-lg leading-relaxed">
            {t("subtitle")}
          </p>
        </div>
      </header>

      {facets.length > 0 && (
        <nav aria-label={t("browseByFacet")} className="py-8">
          <FacetPills facets={facets} labels={facetLabels} />
        </nav>
      )}

      {posts.length === 0 ? (
        <div className="border-base-300 rounded-2xl border border-dashed py-24 text-center">
          <p className="text-base-content/60">{t("empty")}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-8 pb-4">
          {featured && (
            <PostCard
              post={featured}
              locale={locale}
              minutesLabel={t("minutes")}
              featured
              index={0}
            />
          )}

          {rest.length > 0 && (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((post, i) => (
                <PostCard
                  key={post._id}
                  post={post}
                  locale={locale}
                  minutesLabel={t("minutes")}
                  index={i + 1}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {totalPages > 1 && (
        <nav className="flex justify-center pt-12">
          <div className="join">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
              <Link
                key={n}
                href={n === 1 ? "/blog" : `/blog?page=${n}`}
                className={`join-item btn btn-sm ${
                  n === current ? "btn-primary" : "btn-ghost"
                }`}
              >
                {n}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}
