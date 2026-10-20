import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getVisitor } from "@/lib/discover/visitor.server";
import { discoverHref } from "@/lib/discover/routes";
import { storyArticleFor } from "@/lib/discover/articles";
import { DiscoverHub } from "./_components/hub/DiscoverHub";

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
export default async function DiscoverPage() {
  const { visitor, userId } = await getVisitor();
  if (visitor.recipient) redirect(discoverHref(visitor.recipient));

  const article = await storyArticleFor(null, await getLocale());
  return (
    <DiscoverHub visitor={visitor} userId={userId} recipient={null} category={null} article={article} />
  );
}
