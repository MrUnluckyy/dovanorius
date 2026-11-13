import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { BrowseClient } from "./BrowseClient";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const t = await getTranslations("Discover");
  // Every search and filter combination is its own URL. Only the bare page
  // belongs in the index; the variants point back to it.
  const filtered = Object.keys(await searchParams).length > 0;
  return {
    title: t("browseMetaTitle"),
    description: t("browseMetaDescription"),
    alternates: { canonical: "/idejos/visos" },
    robots: filtered ? { index: false, follow: true } : undefined,
  };
}

export default function BrowsePage() {
  return (
    // useSearchParams needs a Suspense boundary, or the whole route opts out of
    // static rendering.
    <Suspense fallback={<div className="min-h-screen" />}>
      <BrowseClient />
    </Suspense>
  );
}
