"use client";

import { useQuery } from "@tanstack/react-query";

/** One AI-ranked gift pick (mirrors GiftIdea in lib/gifts/recommend). */
export type GiftIdea = {
  product_id: string;
  title: string;
  price: number | null;
  image_url: string | null;
  deep_link: string | null;
  /** One-sentence, Lithuanian reason tying the gift to the person. */
  reason: string;
};

/** The inferred taste profile summary shown above the picks. */
export type TasteProfile = {
  summary: string;
  interests: string[];
  categories: string[];
  brands: string[];
  price_min: number | null;
  price_max: number | null;
  gender: "female" | "male" | "unisex" | null;
  life_context: string[];
};

export type GiftIdeasResponse = {
  from_cache: boolean;
  cost_usd: number;
  profile: TasteProfile;
  ideas: GiftIdea[];
};

/**
 * Personalized AI gift ideas for a user. The server caches results per
 * (user, occasion, price band, profile version) for a week, so this is cheap to
 * refetch; we keep it fresh for 30 min client-side.
 */
export function useGiftIdeas(
  userId: string | null,
  occasion: string,
  priceMin: number | null = null,
  priceMax: number | null = null
) {
  return useQuery<GiftIdeasResponse>({
    queryKey: ["gift-ideas", userId, occasion, priceMin, priceMax],
    enabled: !!userId,
    staleTime: 1000 * 60 * 30,
    retry: false,
    queryFn: async () => {
      const params = new URLSearchParams({ userId: userId!, occasion });
      if (priceMin != null) params.set("priceMin", String(priceMin));
      if (priceMax != null) params.set("priceMax", String(priceMax));
      const res = await fetch(`/api/gift-ideas?${params.toString()}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || "Failed to load gift ideas");
      }
      return res.json();
    },
  });
}
