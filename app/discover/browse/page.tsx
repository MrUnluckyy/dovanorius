import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { BrowseClient } from "./BrowseClient";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Discover");
  return {
    title: t("browseMetaTitle"),
    description: t("browseMetaDescription"),
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
