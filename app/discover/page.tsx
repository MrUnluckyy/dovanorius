import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { DiscoverClient } from "./DiscoverClient";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Discover");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    // Hidden while Discover is still being refined: reachable by direct URL
    // only (no nav link), and kept out of search engines.
    robots: { index: false, follow: false },
  };
}

export default function DiscoverPage() {
  return <DiscoverClient />;
}
