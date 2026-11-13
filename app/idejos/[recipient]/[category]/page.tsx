import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { getVisitor } from "@/lib/discover/visitor.server";
import { CATEGORY_SLUGS, RECIPIENT_SLUGS, categoryFromSlug, recipientFromSlug } from "@/lib/discover/routes";
import { storyArticleFor } from "@/lib/discover/articles";
import { placementFor } from "@/lib/discover/placements";
import { initialGridFor } from "@/lib/discover/ssrGrid.server";
import { priceBand } from "../../_components/filters";
import { discoverBreadcrumb, discoverPageMetadata } from "@/lib/discover/pageSeo.server";
import { DiscoverHub } from "../../_components/hub/DiscoverHub";
import { JsonLd } from "../../_components/JsonLd";

// Every recipient × category pair is known up front; anything else is a 404.
export const dynamicParams = false;
export function generateStaticParams() {
  return Object.values(RECIPIENT_SLUGS).flatMap((recipient) =>
    Object.values(CATEGORY_SLUGS).map((category) => ({ recipient, category }))
  );
}

type Params = { params: Promise<{ recipient: string; category: string }> };
type PageProps = Params & { searchParams: Promise<{ price?: string }> };

async function resolve(params: Params["params"]) {
  const p = await params;
  return { recipient: recipientFromSlug(p.recipient), category: categoryFromSlug(p.category) };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { recipient, category } = await resolve(params);
  if (!recipient || !category) return {};
  return discoverPageMetadata(recipient, category);
}

/** A category inside a recipient: its collections first, then its grid. */
export default async function RecipientCategoryPage({ params, searchParams }: PageProps) {
  const { recipient, category } = await resolve(params);
  if (!recipient || !category) notFound();

  const [{ visitor, userId }, locale] = await Promise.all([getVisitor(), getLocale()]);
  const [article, ad, initialGrid, breadcrumb] = await Promise.all([
    storyArticleFor(recipient, locale),
    placementFor(recipient, category),
    initialGridFor(recipient, category, visitor.gender, priceBand((await searchParams).price)),
    discoverBreadcrumb(recipient, category),
  ]);
  return (
    <>
      <JsonLd data={breadcrumb} />
      <DiscoverHub
        visitor={visitor}
        userId={userId}
        recipient={recipient}
        category={category}
        article={article}
        ad={ad}
        initialGrid={initialGrid}
      />
    </>
  );
}
