import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createClient } from "@/utils/supabase/client";
import type { Audience } from "@/types/inspo";

/** Why a shelf is where it is; drives the reason line under its title. */
export type CollectionReason =
  | "recipient"
  | "behaviour"
  | "prior"
  | "season"
  | "popular"
  | "explore";

export type RankedCollection = {
  persona_id: string;
  slug: string;
  rank: number;
  /** On the first screen; the rest sit under "Visos kolekcijos". */
  is_top: boolean;
  reason: CollectionReason | null;
  /** product_type behind a "behaviour" reason, e.g. "toys". */
  reason_detail: string | null;
};

/**
 * The inline shelves, ranked for this visitor by discover_rank_collections
 * (collection ranking v1, see dev-issue-discover-premium 4.8). The same RPC
 * serves noriuto-app, so both clients agree on the order.
 *
 * Signed-in users and anonymous guests are read from their profile and history
 * server-side; the only inputs from here are the choices made on this page.
 *
 * Errors are swallowed into `undefined` on purpose: the caller falls back to
 * the fixed sort_order, so a failed ranking costs relevance, never the page.
 */
export function useRankedCollections(
  recipientSlug: string | null,
  audience: Audience,
  enabled: boolean
) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["discover-ranked-collections", recipientSlug, audience],
    enabled,
    staleTime: 1000 * 60 * 5,
    retry: false,
    // Tapping a recipient re-ranks; keep the current order on screen meanwhile
    // instead of dropping the whole page back to skeletons.
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<RankedCollection[] | null> => {
      const { data, error } = await supabase.rpc("discover_rank_collections", {
        p_recipient: recipientSlug,
        p_audience: audience,
      });
      if (error) return null;
      return (data ?? []) as RankedCollection[];
    },
  });
}
