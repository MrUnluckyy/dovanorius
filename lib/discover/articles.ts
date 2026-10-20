// Server only: imported from route segments, never from client components.
import { client } from "@/sanity/client";
import { urlFor } from "@/sanity/image";
import type { RecipientKey } from "./recipients";

/**
 * Gift guides for the story block (articles now; sponsored placements are the
 * next PR). A recipient page shows the newest guide tagged with its gift facet
 * in Sanity, and falls back to the newest guide overall, so the slot is never
 * empty while the blog is small.
 */
export type StoryArticle = {
  slug: string;
  title: string;
  excerpt: string | null;
  image: string | null;
  imageAlt: string | null;
};

/** Recipient → Sanity giftFacet slugs (recipient kind), best match first. */
const FACETS: Partial<Record<RecipientKey, string[]>> = {
  woman: ["moteriai", "merginai", "mamai"],
  mom: ["mamai", "moteriai"],
  friend: ["draugei", "merginai", "moteriai"],
  man: ["vyrui", "vaikinui", "teciui"],
  partner: ["vaikinui", "merginai"],
  kid: ["vaikui"],
  teen: ["paaugliui", "paauglei"],
  baby: ["naujagimiui", "kudikiui"],
  home: ["ikurtuvems"],
  couple: ["porai"],
};

const L = (f: string) =>
  `coalesce(${f}[language == $locale || _key == $locale][0].value, ${f}[language == "lt" || _key == "lt"][0].value)`;

const QUERY = /* groq */ `{
  "tagged": *[_type == "post" && defined(slug.current) && publishedAt <= now()
    && count((facets[]->slug.current)[@ in $facets]) > 0]
    | order(publishedAt desc)[0]{ "slug": slug.current, "title": ${L("title")}, "excerpt": ${L("excerpt")}, coverImage },
  "latest": *[_type == "post" && defined(slug.current) && publishedAt <= now()]
    | order(publishedAt desc)[0]{ "slug": slug.current, "title": ${L("title")}, "excerpt": ${L("excerpt")}, coverImage }
}`;

type Row = {
  slug: string;
  title: string | null;
  excerpt: string | null;
  coverImage?: { alt?: string; asset?: { _ref?: string } } | null;
} | null;

export async function storyArticleFor(
  recipient: RecipientKey | null,
  locale: string
): Promise<StoryArticle | null> {
  try {
    const res = await client.fetch<{ tagged: Row; latest: Row }>(
      QUERY,
      { facets: (recipient && FACETS[recipient]) || [], locale },
      { next: { revalidate: 3600, tags: ["post"] } }
    );
    const row = res.tagged ?? res.latest;
    if (!row?.title) return null;
    return {
      slug: row.slug,
      title: row.title,
      excerpt: row.excerpt,
      image: row.coverImage?.asset ? urlFor(row.coverImage).width(1200).auto("format").url() : null,
      imageAlt: row.coverImage?.alt ?? null,
    };
  } catch {
    // The blog must never take discover down with it.
    return null;
  }
}
