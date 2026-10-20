import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getVisitor } from "@/lib/discover/visitor.server";
import type { GiftPersona } from "@/hooks/usePersonas";
import { CollectionClient } from "./CollectionClient";

type Params = { params: Promise<{ slug: string }> };

/** RLS (gift_personas_read) already hides inactive and out-of-window shelves. */
async function getCollection(slug: string): Promise<GiftPersona | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("gift_personas")
    .select("id, slug, label_lt, label_en, gender, kind, exclude_keywords")
    .eq("slug", slug)
    .maybeSingle();
  return (data as GiftPersona | null) ?? null;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const c = await getCollection((await params).slug);
  return c ? { title: `${c.label_lt} – Noriuto.lt` } : {};
}

/** One collection, full page: every curated pick, then "more from here". */
export default async function CollectionPage({ params }: Params) {
  const collection = await getCollection((await params).slug);
  if (!collection) notFound();
  const { visitor, userId } = await getVisitor();
  return <CollectionClient collection={collection} accountId={visitor.isAccount ? userId : null} />;
}
