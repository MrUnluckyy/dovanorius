import type { Metadata } from "next";
import { Suspense, cache } from "react";
import { notFound, permanentRedirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { BrowseClient, type ShopInfo } from "../../visos/BrowseClient";
import { CATEGORIES } from "../../_components/filters";

/**
 * A direct partner's shop inside Discover: "liked this toy, show me more from
 * the same place". The catalogue is BrowseClient scoped to one merchant.
 *
 * partners is only readable by its own members, so the few public fields are
 * read here with the service role. Inactive partners 404.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PRICE_FLOOR = 10; // same gate as hooks/useInspoProducts.ts

const loadShop = cache(async (key: string): Promise<ShopInfo | { redirectTo: string } | null> => {
  // The product modal links by partner id (that is what a product row knows);
  // the canonical URL is the slug.
  const byId = UUID.test(key);
  const { data: partner } = await supabaseAdmin
    .from("partners")
    .select("id, name, slug, website_url")
    .eq(byId ? "id" : "slug", key)
    .eq("is_active", true)
    .maybeSingle();
  if (!partner?.slug) return null;
  if (byId) return { redirectTo: `/idejos/parduotuve/${partner.slug}` };

  // Visible = what Discover would actually show (see useInspoProducts).
  const visible = () =>
    supabaseAdmin
      .from("inspo_products")
      .select("id", { count: "exact", head: true })
      .eq("partner_id", partner.id)
      .eq("in_stock", true)
      .eq("giftable", true)
      .not("image_url", "is", null)
      .not("deep_link", "is", null)
      .gte("price", PRICE_FLOOR);

  const [{ count }, ...perType] = await Promise.all([
    visible(),
    ...CATEGORIES.map((c) => visible().eq("product_type", c.type)),
  ]);

  return {
    name: partner.name,
    slug: partner.slug,
    websiteUrl: partner.website_url,
    count: count ?? 0,
    types: CATEGORIES.filter((_, i) => (perType[i].count ?? 0) > 0).map((c) => c.type),
  };
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const shop = await loadShop(slug);
  if (!shop || "redirectTo" in shop) return {};
  const t = await getTranslations("Discover");
  return {
    title: t("shop.metaTitle", { shop: shop.name }),
    description: t("shop.metaDescription", { shop: shop.name }),
  };
}

export default async function ShopPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const shop = await loadShop(slug);
  if (!shop) notFound();
  if ("redirectTo" in shop) permanentRedirect(shop.redirectTo);

  return (
    // BrowseClient reads useSearchParams, which needs a Suspense boundary.
    <Suspense fallback={<div className="min-h-screen" />}>
      <BrowseClient shop={shop} />
    </Suspense>
  );
}
