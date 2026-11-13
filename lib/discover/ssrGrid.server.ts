/**
 * The discover grid's first page, fetched on the server so it is in the HTML.
 *
 * Until this existed every discover page shipped without a single product:
 * the grid loaded in the browser after hydration, so search engines indexed
 * "Dovanos moteriai" as a title over an empty grid. Now the page renders the
 * first page and the browser adopts it (useInspoProducts `initialPage`).
 *
 * The grid is not personal (filters come from the URL, plus the visitor's
 * gender on "Sau" only), so it is read with a cookieless anon client and
 * cached for an hour per filter set. A failure renders the page exactly as
 * before (the browser loads the grid) rather than failing it.
 */
import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import type { InspoFilters, InspoProduct } from "@/types/inspo";
import type { RecipientKey, VisitorGender } from "./recipients";
import type { Occasion } from "./occasions";
import {
  discoverPageArgs,
  ideasGridFilters,
  ideasGridScope,
  type InitialGrid,
} from "./gridQuery";

const firstPage = unstable_cache(
  async (key: string): Promise<InspoProduct[]> => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const filters = JSON.parse(key) as InspoFilters;
    const { data, error } = await supabase.rpc("discover_page", discoverPageArgs(filters, null));
    if (error) throw error;
    return (data ?? []) as InspoProduct[];
  },
  ["discover-grid-v1"],
  { revalidate: 3600, tags: ["discover-grid"] }
);

export async function initialGridFor(
  recipient: RecipientKey | null,
  category: string | null,
  gender: VisitorGender,
  budget: { min: number | null; max: number | null } = { min: null, max: null },
  occasion: Occasion | null = null
): Promise<InitialGrid | null> {
  const key = JSON.stringify(
    ideasGridFilters({
      ...ideasGridScope(recipient, category, gender, occasion),
      priceMin: budget.min,
      priceMax: budget.max,
    })
  );
  try {
    return { key, products: await firstPage(key) };
  } catch (err) {
    console.error("[discover] server grid failed", err);
    return null;
  }
}
