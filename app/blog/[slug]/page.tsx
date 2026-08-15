import type { Metadata } from "next";
import { PortableText, type PortableTextBlock } from "next-sanity";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";

import ShareBar from "@/components/blog/ShareBar";
import SanityImage from "@/components/SanityImage";
import { absoluteUrl } from "@/lib/siteUrl";
import { buildArticleJsonLd, buildItemListJsonLd } from "@/sanity/jsonld";
import { sanityFetch } from "@/sanity/live";
import { getPortableTextComponents } from "@/sanity/portable-text";
import { POST_QUERY } from "@/sanity/queries";

type Post = {
  _id: string;
  slug: string;
  publishedAt: string;
  _updatedAt: string;
  title: string | null;
  excerpt: string | null;
  coverImage: React.ComponentProps<typeof SanityImage>["value"];
  body: PortableTextBlock[] | null;
  readingTime: number | null;
  author: {
    name: string;
    slug: string;
    image: React.ComponentProps<typeof SanityImage>["value"];
    bio: string | null;
  } | null;
  categories: { slug: string; title: string | null }[] | null;
  seo: {
    metaTitle: string | null;
    metaDescription: string | null;
    noIndex: boolean | null;
  } | null;
};

async function getPost(slug: string) {
  const locale = await getLocale();
  const { data } = await sanityFetch({
    query: POST_QUERY,
    params: { slug, locale },
    tags: ["post", `post:${slug}`],
  });
  return data as Post | null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return {};

  const title = post.seo?.metaTitle ?? post.title ?? undefined;
  const description = post.seo?.metaDescription ?? post.excerpt ?? undefined;
  const canonical = `/blog/${post.slug}`;

  // Fall back to the site-wide social card when a post has no cover image, so
  // shares are never left without a preview image.
  const shareImage = post.coverImage?.asset?.url ?? "/assets/meta/noriuto-meta.jpg";

  return {
    title,
    description,
    alternates: { canonical },
    robots: post.seo?.noIndex ? { index: false, follow: false } : undefined,
    openGraph: {
      type: "article",
      title,
      description,
      url: canonical,
      siteName: "Noriuto",
      locale: await getLocale(),
      publishedTime: post.publishedAt,
      modifiedTime: post._updatedAt,
      images: [{ url: shareImage }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [shareImage],
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [post, locale, t] = await Promise.all([
    getPost(slug),
    getLocale(),
    getTranslations("Blog"),
  ]);

  if (!post) notFound();

  const pageUrl = absoluteUrl(`/blog/${post.slug}`);

  const articleJsonLd = buildArticleJsonLd({
    title: post.title ?? "",
    description: post.excerpt,
    url: pageUrl,
    imageUrl: post.coverImage?.asset?.url,
    publishedAt: post.publishedAt,
    updatedAt: post._updatedAt,
    authorName: post.author?.name,
  });
  const itemListJsonLd = buildItemListJsonLd(post.body, {
    name: post.title ?? "",
    url: pageUrl,
  });

  const publishedLabel = new Date(post.publishedAt).toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      {itemListJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
        />
      )}

      <article className="mx-auto max-w-3xl px-4 sm:px-8">
        <header className="pt-10 pb-8 md:pt-14">
          <nav className="text-base-content/55 mb-6 flex items-center gap-2 text-sm">
            <Link href="/blog" className="hover:text-primary transition-colors">
              {t("title")}
            </Link>
            <span aria-hidden>/</span>
            <span className="text-base-content/80 truncate">{post.title}</span>
          </nav>

          {post.categories && post.categories.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-1.5">
              {post.categories.map((category) => (
                <span
                  key={category.slug}
                  className="bg-primary/10 text-primary rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase"
                >
                  {category.title}
                </span>
              ))}
            </div>
          )}

          <h1 className="font-heading text-3xl leading-[1.1] font-bold text-balance md:text-5xl">
            {post.title}
          </h1>

          {post.excerpt && (
            <p className="text-base-content/70 mt-4 text-lg leading-relaxed">
              {post.excerpt}
            </p>
          )}

          <div className="text-base-content/55 border-base-300/60 mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 border-t pt-5 text-sm">
            {post.author?.image?.asset && (
              <SanityImage
                value={post.author.image}
                width={64}
                height={64}
                sizes="32px"
                className="size-8 rounded-full object-cover"
              />
            )}
            {post.author?.name && (
              <span className="text-base-content/80 font-medium">
                {post.author.name}
              </span>
            )}
            <time dateTime={post.publishedAt}>{publishedLabel}</time>
            {post.readingTime != null && (
              <>
                <span aria-hidden>·</span>
                <span>
                  {Math.max(1, post.readingTime)} {t("minutes")}
                </span>
              </>
            )}
          </div>
        </header>

        {/* No fallback gradient here on purpose: as a full-width hero it is
            just decorative filler. The card grid is where it earns its place. */}
        {post.coverImage?.asset && (
          <div className="mb-10 overflow-hidden rounded-2xl">
            <SanityImage
              value={post.coverImage}
              width={1200}
              priority
              sizes="(max-width: 768px) 100vw, 768px"
              className="h-auto w-full"
            />
          </div>
        )}

        {post.body && (
          // `prose`-like rhythm without the plugin; the clearfix contains
          // floated body images.
          <div className="text-[1.0625rem] leading-[1.75] after:block after:clear-both after:content-['']">
            <PortableText
              value={post.body}
              components={getPortableTextComponents(t)}
            />
          </div>
        )}

        <ShareBar
          url={pageUrl}
          title={post.title ?? ""}
          labels={{
            share: t("share"),
            copyLink: t("copyLink"),
            copied: t("copied"),
            copyFailed: t("copyFailed"),
          }}
        />

        {post.author?.bio && (
          <footer className="border-base-300/60 bg-base-200/40 mt-14 flex gap-4 rounded-2xl border p-6">
            {post.author.image?.asset && (
              <SanityImage
                value={post.author.image}
                width={128}
                height={128}
                sizes="64px"
                className="size-16 shrink-0 rounded-full object-cover"
              />
            )}
            <div>
              <p className="font-heading font-bold">{post.author.name}</p>
              <p className="text-base-content/70 mt-1 text-sm leading-relaxed">
                {post.author.bio}
              </p>
            </div>
          </footer>
        )}

        <div className="mt-12 flex justify-center">
          <Link href="/blog" className="btn btn-ghost btn-sm">
            ← {t("backToList")}
          </Link>
        </div>
      </article>
    </>
  );
}
