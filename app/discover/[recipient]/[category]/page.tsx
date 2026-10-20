import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getVisitor } from "@/lib/discover/visitor.server";
import { CATEGORY_SLUGS, RECIPIENT_SLUGS, categoryFromSlug, recipientFromSlug } from "@/lib/discover/routes";
import { storyArticleFor } from "@/lib/discover/articles";
import { DiscoverHub } from "../../_components/hub/DiscoverHub";

// Every recipient × category pair is known up front; anything else is a 404.
export const dynamicParams = false;
export function generateStaticParams() {
  return Object.values(RECIPIENT_SLUGS).flatMap((recipient) =>
    Object.values(CATEGORY_SLUGS).map((category) => ({ recipient, category }))
  );
}

type Params = { params: Promise<{ recipient: string; category: string }> };

async function resolve(params: Params["params"]) {
  const p = await params;
  return { recipient: recipientFromSlug(p.recipient), category: categoryFromSlug(p.category) };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { recipient, category } = await resolve(params);
  if (!recipient || !category) return {};
  const t = await getTranslations("Discover");
  return {
    title: t("hub.metaCategoryTitle", {
      category: t(`category.${category}`),
      recipient: t(`recipient.${recipient}`).toLocaleLowerCase("lt"),
    }),
    robots: recipient === "self" ? { index: false } : undefined,
  };
}

/** A category inside a recipient: its collections first, then its grid. */
export default async function RecipientCategoryPage({ params }: Params) {
  const { recipient, category } = await resolve(params);
  if (!recipient || !category) notFound();

  const [{ visitor, userId }, locale] = await Promise.all([getVisitor(), getLocale()]);
  const article = await storyArticleFor(recipient, locale);
  return (
    <DiscoverHub visitor={visitor} userId={userId} recipient={recipient} category={category} article={article} />
  );
}
