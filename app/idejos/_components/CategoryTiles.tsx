"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { createClient } from "@/utils/supabase/client";

export type Category = { key: string; type: string; emoji: string };

/** One representative product image per category, for the tile background. */
function useCategoryPreviews(types: string[]) {
  const supabase = createClient();
  return useQuery({
    queryKey: ["category-previews", types],
    staleTime: 1000 * 60 * 60,
    queryFn: async () => {
      const entries = await Promise.all(
        types.map(async (type) => {
          const { data } = await supabase
            .from("inspo_products")
            .select("image_url")
            .eq("product_type", type)
            .eq("in_stock", true)
            .not("image_url", "is", null)
            .order("sort_key", { ascending: true })
            .limit(1)
            .maybeSingle();
          return [type, data?.image_url ?? null] as const;
        })
      );
      return Object.fromEntries(entries) as Record<string, string | null>;
    },
  });
}

export function CategoryTiles({
  categories,
  active,
  onSelect,
}: {
  categories: Category[];
  active: string | null;
  onSelect: (type: string | null) => void;
}) {
  const t = useTranslations("Discover");
  const { data: previews = {} } = useCategoryPreviews(
    categories.map((c) => c.type)
  );

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {categories.map((c) => {
        const isActive = active === c.type;
        const img = previews[c.type];
        return (
          <button
            key={c.type}
            onClick={() => onSelect(isActive ? null : c.type)}
            aria-pressed={isActive}
            className={`group relative overflow-hidden rounded-3xl ring-1 transition duration-200 hover:-translate-y-0.5 hover:shadow-lg ${
              isActive
                ? "ring-2 ring-primary"
                : "ring-base-300/70 hover:ring-base-300"
            }`}
          >
            <div className="aspect-[4/3] w-full overflow-hidden bg-base-200">
              {img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={img}
                  alt=""
                  aria-hidden
                  className="h-full w-full object-cover opacity-95 transition duration-500 group-hover:scale-105"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <div className="grid h-full w-full place-items-center text-4xl opacity-40">
                  {c.emoji}
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
            </div>
            <div className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 p-3">
              <span aria-hidden className="text-lg drop-shadow">
                {c.emoji}
              </span>
              <span className="font-heading text-lg font-bold tracking-tight text-white drop-shadow">
                {t(`category.${c.key}`)}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
