import { stegaClean } from "next-sanity";

import type { GiftPicksValue } from "@/components/blog/GiftPicks";

/** Loose enough to accept `PortableTextBlock[]`, which has no index signature. */
type Block = { _type?: string };

/**
 * Google shows list-style rich results for listicles, but only when the items
 * are declared as an ItemList. Derive it from the gift-picks blocks rather than
 * asking authors to maintain it twice.
 */
export function buildItemListJsonLd(
  body: Block[] | null | undefined,
  { name, url }: { name: string; url: string }
) {
  if (!Array.isArray(body)) return null;

  const picks = body.filter(
    (block) => block?._type === "pteGiftPicks"
  ) as unknown as GiftPicksValue[];

  const items = picks.flatMap((block) => block.items ?? []);
  if (items.length === 0) return null;

  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: stegaClean(name),
    url,
    numberOfItems: items.length,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: stegaClean(item.title) ?? undefined,
      description: stegaClean(item.description) ?? undefined,
      image: item.image?.asset?.url ?? undefined,
      url: stegaClean(item.url) ?? undefined,
    })),
  };
}

/** Article metadata for the post itself. */
export function buildArticleJsonLd({
  title,
  description,
  url,
  imageUrl,
  publishedAt,
  updatedAt,
  authorName,
}: {
  title: string;
  description?: string | null;
  url: string;
  imageUrl?: string | null;
  publishedAt: string;
  updatedAt: string;
  authorName?: string | null;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: stegaClean(title),
    description: description ? stegaClean(description) : undefined,
    mainEntityOfPage: url,
    image: imageUrl ?? undefined,
    datePublished: publishedAt,
    dateModified: updatedAt,
    author: authorName
      ? { "@type": "Person", name: stegaClean(authorName) }
      : undefined,
  };
}
