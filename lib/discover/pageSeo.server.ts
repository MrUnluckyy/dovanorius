/**
 * Metadata and structured data for recipient and category pages, built from
 * what the page actually shows (its server-rendered first grid page).
 */
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { RecipientKey } from "./recipients";
import { discoverHref } from "./routes";
import { initialGridFor } from "./ssrGrid.server";
import { breadcrumbJsonLd, isIndexable, minPrice, topBrands } from "./seo";

async function titles(recipient: RecipientKey, category: string | null) {
  const t = await getTranslations("Discover");
  const label = t(`recipient.${recipient}`).toLocaleLowerCase("lt");
  const recipientTitle = t("hub.recipientTitle", { recipient: label });
  const title = category
    ? t("hub.categoryTitle", { category: t(`categoryGen.${category}`), recipient: label })
    : recipientTitle;
  return { t, label, recipientTitle, title };
}

export async function discoverPageMetadata(
  recipient: RecipientKey,
  category: string | null
): Promise<Metadata> {
  const { t, label, title } = await titles(recipient, category);
  // What a crawler sees: no cookies, so no gender.
  const grid = await initialGridFor(recipient, category, null);
  const products = grid?.products ?? [];
  const brands = topBrands(products);
  const from = minPrice(products);

  const description =
    brands.length >= 2 && from != null
      ? t("hub.metaPageDescriptionBrands", { title, brands: brands.join(", "), from })
      : category
        ? t("hub.metaPageDescription", { title })
        : t("hub.metaRecipientDescription", { recipient: label });

  const path = discoverHref(recipient, category);
  return {
    title: category
      ? t("hub.metaCategoryTitle", { title })
      : t("hub.metaRecipientTitle", { recipient: label }),
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path },
    // A failed grid fetch (null) must not de-index a page, so it only counts
    // products when it has them.
    robots: isIndexable(recipient, category, grid ? products.length : Infinity)
      ? undefined
      : { index: false, follow: true },
  };
}

export async function discoverBreadcrumb(recipient: RecipientKey, category: string | null) {
  const { t, recipientTitle, title } = await titles(recipient, category);
  return breadcrumbJsonLd([
    { name: t("hub.breadcrumbRoot"), path: "/idejos" },
    { name: recipientTitle, path: discoverHref(recipient) },
    ...(category ? [{ name: title, path: discoverHref(recipient, category) }] : []),
  ]);
}
