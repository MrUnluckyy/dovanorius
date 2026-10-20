import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getVisitor } from "@/lib/discover/visitor.server";
import { RECIPIENT_SLUGS, recipientFromSlug } from "@/lib/discover/routes";
import { storyArticleFor } from "@/lib/discover/articles";
import { placementFor } from "@/lib/discover/placements";
import { DiscoverHub } from "../_components/hub/DiscoverHub";

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
  const t = await getTranslations("Discover");
  const label = t(`recipient.${recipient}`).toLocaleLowerCase("lt");
  return {
    title: t("hub.metaRecipientTitle", { recipient: label }),
    description: t("hub.metaRecipientDescription", { recipient: label }),
    // "Sau" is personal; the gift pages are what should rank.
    robots: recipient === "self" ? { index: false } : undefined,
  };
}

/** "Dovanos moteriai": one recipient's hub. */
export default async function RecipientPage({ params }: Params) {
  const recipient = recipientFromSlug((await params).recipient);
  if (!recipient) notFound();

  const [{ visitor, userId }, locale] = await Promise.all([getVisitor(), getLocale()]);
  const [article, ad] = await Promise.all([
    storyArticleFor(recipient, locale),
    placementFor(recipient, null),
  ]);
  return (
    <DiscoverHub visitor={visitor} userId={userId} recipient={recipient} category={null} article={article} ad={ad} />
  );
}
