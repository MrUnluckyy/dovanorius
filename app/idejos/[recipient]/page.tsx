import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { getVisitor } from "@/lib/discover/visitor.server";
import { RECIPIENT_SLUGS, recipientFromSlug } from "@/lib/discover/routes";
import { storyArticleFor } from "@/lib/discover/articles";
import { placementFor } from "@/lib/discover/placements";
import { initialGridFor } from "@/lib/discover/ssrGrid.server";
import { discoverBreadcrumb, discoverPageMetadata } from "@/lib/discover/pageSeo.server";
import { DiscoverHub } from "../_components/hub/DiscoverHub";
import { JsonLd } from "../_components/JsonLd";

// Only real recipients exist; anything else is a hard 404, not a streamed
// "not found" page with a 200 status.
export const dynamicParams = false;
export function generateStaticParams() {
  return Object.values(RECIPIENT_SLUGS).map((recipient) => ({ recipient }));
}

type Params = { params: Promise<{ recipient: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const recipient = recipientFromSlug((await params).recipient);
  if (!recipient) return {};
  return discoverPageMetadata(recipient, null);
}

/** "Dovanos moteriai": one recipient's hub. */
export default async function RecipientPage({ params }: Params) {
  const recipient = recipientFromSlug((await params).recipient);
  if (!recipient) notFound();

  const [{ visitor, userId }, locale] = await Promise.all([getVisitor(), getLocale()]);
  const [article, ad, initialGrid, breadcrumb] = await Promise.all([
    storyArticleFor(recipient, locale),
    placementFor(recipient, null),
    // The grid's first page, in the HTML (search engines saw an empty grid).
    initialGridFor(recipient, null, visitor.gender),
    discoverBreadcrumb(recipient, null),
  ]);
  return (
    <>
      <JsonLd data={breadcrumb} />
      <DiscoverHub
        visitor={visitor}
        userId={userId}
        recipient={recipient}
        category={null}
        article={article}
        ad={ad}
        initialGrid={initialGrid}
      />
    </>
  );
}
