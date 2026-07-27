import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { DiscoverClient } from "./DiscoverClient";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Discover");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default function DiscoverPage() {
  return <DiscoverClient />;
}
