import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getVisitor } from "@/lib/discover/visitor.server";
import { discoverHref } from "@/lib/discover/routes";
import { storyArticleFor } from "@/lib/discover/articles";
import { placementFor } from "@/lib/discover/placements";
import { loadEventEntry } from "@/lib/discover/eventEntry.server";
import { DiscoverHub } from "./_components/hub/DiscoverHub";
import { EventHub } from "./_components/hub/EventHub";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Discover");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

/**
 * The discover home. Someone we know something about goes straight to their
 * recipient (last choice, or "Sau" once the gender is known), the way Zalando
 * reopens on the last department. Everyone else, crawlers included, gets
 * "Kam ieškai dovanos?" with the recipient gallery.
 */
export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string }>;
}) {
  const { visitor, userId } = await getVisitor();

  // From a Secret Santa reveal: the giver gets their recipient's page (4.6).
  // Anyone else carrying the parameter falls through to normal discover.
  const { event } = await searchParams;
  if (event) {
    const entry = await loadEventEntry(event);
    if (entry) return <EventHub entry={entry} accountId={visitor.isAccount ? userId : null} />;
  }

  if (visitor.recipient) redirect(discoverHref(visitor.recipient));

  const [article, ad] = await Promise.all([
    storyArticleFor(null, await getLocale()),
    placementFor(null, null),
  ]);
  return (
    <DiscoverHub visitor={visitor} userId={userId} recipient={null} category={null} article={article} ad={ad} />
  );
}
