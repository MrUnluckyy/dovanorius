import type { Metadata } from "next";
import { PortableText, type PortableTextBlock } from "next-sanity";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";

import FacetPills, { type Facet as FacetPill } from "@/components/blog/FacetPills";
import PostCard, { type PostCardData } from "@/components/blog/PostCard";
import { sanityFetch } from "@/sanity/live";
import { getPortableTextComponents } from "@/sanity/portable-text";
import {
  FACET_POSTS_COUNT_QUERY,
  FACET_POSTS_QUERY,
  FACET_QUERY,
  FEATURED_FACETS_QUERY,
} from "@/sanity/queries";

const PAGE_SIZE = 12;

type Facet = {
  _id: string;
  kind: string;
  slug: string;
  title: string | null;
  intro: PortableTextBlock[] | null;
  seo: { metaTitle: string | null; metaDescription: string | null } | null;
};

async function getFacet(facet: string) {
  const locale = await getLocale();
  const { data } = await sanityFetch({
    query: FACET_QUERY,
    params: { facet, locale },
    tags: ["giftFacet", `giftFacet:${facet}`],
  });
  return data as Facet | null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ facet: string }>;
}): Promise<Metadata> {
  const { facet: facetSlug } = await params;
  const facet = await getFacet(facetSlug);
  if (!facet) return {};

  return {
    title: facet.seo?.metaTitle ?? facet.title ?? undefined,
    description: facet.seo?.metaDescription ?? undefined,
    alternates: { canonical: `/blog/dovanos/${facet.slug}` },
  };
}

export default async function FacetPage({
  params,
  searchParams,
}: {
  params: Promise<{ facet: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const [{ facet: facetSlug }, { page }] = await Promise.all([
    params,
    searchParams,
  ]);

  const facet = await getFacet(facetSlug);
  if (!facet) notFound();

  const [locale, t] = await Promise.all([getLocale(), getTranslations("Blog")]);

  const current = Math.max(1, Number(page) || 1);
  const start = (current - 1) * PAGE_SIZE;

  const [postsResult, countResult, facetsResult] = await Promise.all([
    sanityFetch({
      query: FACET_POSTS_QUERY,
      params: { facetId: facet._id, locale, start, end: start + PAGE_SIZE },
      tags: ["post"],
    }),
    sanityFetch({
      query: FACET_POSTS_COUNT_QUERY,
      params: { facetId: facet._id },
      tags: ["post"],
    }),
    sanityFetch({
      query: FEATURED_FACETS_QUERY,
      params: { locale },
      tags: ["giftFacet"],
    }),
  ]);

  const posts = (postsResult.data ?? []) as PostCardData[];
  const total = (countResult.data ?? 0) as number;
  const facets = (facetsResult.data ?? []) as FacetPill[];
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const facetLabels = {
    recipient: t("facetRecipient"),
    occasion: t("facetOccasion"),
    priceBand: t("facetPriceBand"),
  };

  return (
    <div className="mx-auto max-w-[1440px] px-4 sm:px-8">
      <header className="border-base-300/60 border-b pt-10 pb-10 md:pt-14 md:pb-12">
        <nav className="text-base-content/55 mb-4 flex items-center gap-2 text-sm">
          <Link href="/blog" className="hover:text-primary transition-colors">
            {t("title")}
          </Link>
          <span aria-hidden>/</span>
          <span className="text-base-content/80">{facet.title}</span>
        </nav>

        <div className="max-w-3xl">
          <h1 className="font-heading text-4xl leading-[1.05] font-bold text-balance md:text-5xl">
            {facet.title}
          </h1>
          {facet.intro && (
            <div className="text-base-content/70 mt-4 max-w-2xl text-lg leading-relaxed [&_p]:mb-3">
              <PortableText
                value={facet.intro}
                components={getPortableTextComponents(t)}
              />
            </div>
          )}
          <p className="text-base-content/45 mt-4 text-sm">
            {total} {total === 1 ? t("postSingular") : t("postPlural")}
          </p>
        </div>
      </header>

      {facets.length > 0 && (
        <nav aria-label={t("browseByFacet")} className="py-8">
          <FacetPills
            facets={facets}
            activeSlug={facet.slug}
            labels={facetLabels}
          />
        </nav>
      )}

      {posts.length === 0 ? (
        <div className="border-base-300 rounded-2xl border border-dashed py-24 text-center">
          <p className="text-base-content/60">{t("empty")}</p>
          <Link href="/blog" className="btn btn-primary btn-sm mt-4">
            {t("allPosts")}
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post, i) => (
            <PostCard
              key={post._id}
              post={post}
              locale={locale}
              minutesLabel={t("minutes")}
              index={i}
            />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <nav className="flex justify-center pt-12">
          <div className="join">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
              <Link
                key={n}
                href={
                  n === 1
                    ? `/blog/dovanos/${facet.slug}`
                    : `/blog/dovanos/${facet.slug}?page=${n}`
                }
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
