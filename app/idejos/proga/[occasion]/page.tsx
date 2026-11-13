import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getVisitor } from "@/lib/discover/visitor.server";
import { OCCASIONS, occasionFromSlug } from "@/lib/discover/occasions";
import { recipientFromSlug } from "@/lib/discover/routes";
import { storyArticleFor } from "@/lib/discover/articles";
import { placementFor } from "@/lib/discover/placements";
import { initialGridFor } from "@/lib/discover/ssrGrid.server";
import { breadcrumbJsonLd } from "@/lib/discover/seo";
import { DiscoverHub } from "../../_components/hub/DiscoverHub";
import { JsonLd } from "../../_components/JsonLd";
import { priceBand } from "../../_components/filters";

// Only the configured occasions exist; anything else is a hard 404.
export const dynamicParams = false;
export function generateStaticParams() {
  return OCCASIONS.map((o) => ({ occasion: o.slug }));
}

type Props = {
  params: Promise<{ occasion: string }>;
  searchParams: Promise<{ kam?: string; price?: string }>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const occasion = occasionFromSlug((await params).occasion);
  if (!occasion) return {};
  const t = await getTranslations("Discover.occasion");
  const title = t(`${occasion.key}.title`);
  const description = t(`${occasion.key}.description`);
  const path = `/idejos/proga/${occasion.slug}`;
  // "Kam?" and budget variants are the same page, filtered: one URL in the index.
  const filtered = Object.keys(await searchParams).length > 0;
  return {
    title: t("metaTitle", { title }),
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path },
    robots: filtered ? { index: false, follow: true } : undefined,
  };
}

/** "Kalėdinės dovanos", "Secret Santa dovanos"…: an occasion's gift page. */
export default async function OccasionPage({ params, searchParams }: Props) {
  const occasion = occasionFromSlug((await params).occasion);
  if (!occasion) notFound();
  const { kam, price } = await searchParams;
  // "Kam?" only offers the occasion's own recipients.
  const picked = kam ? recipientFromSlug(kam) : null;
  const recipient = picked && occasion.recipients.includes(picked) ? picked : null;

  const [{ visitor, userId }, locale, t] = await Promise.all([
    getVisitor(),
    getLocale(),
    getTranslations("Discover"),
  ]);
  const [article, ad, initialGrid] = await Promise.all([
    // The occasion's own guide, unless "Kam?" picked someone it isn't about
    // (the Christmas guide is about teen girls); then the recipient's guide.
    storyArticleFor(recipient, locale, recipient ? null : (occasion.guideSlug ?? null)),
    placementFor(recipient, null),
    initialGridFor(recipient, null, visitor.gender, priceBand(price ?? occasion.defaultPrice), occasion),
  ]);
  const breadcrumb = breadcrumbJsonLd([
    { name: t("hub.breadcrumbRoot"), path: "/idejos" },
    { name: t(`occasion.${occasion.key}.title`), path: `/idejos/proga/${occasion.slug}` },
  ]);

  return (
    <>
      <JsonLd data={breadcrumb} />
      <DiscoverHub
        // A new "Kam?" is a new page state: remount so local state (budget,
        // shelves) starts from the URL again.
        key={`${occasion.slug}:${recipient ?? "all"}`}
        visitor={visitor}
        userId={userId}
        recipient={recipient}
        category={null}
        article={article}
        ad={ad}
        initialGrid={initialGrid}
        occasion={occasion}
      />
    </>
  );
}
