"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/utils/supabase/client";

export type Signal = 1 | -1;
export type FeedbackMap = Record<string, Signal>;

const KEY = ["product-feedback"];

/**
 * The signed-in user's heart/✕ relevance signals, as a { productId: signal }
 * map. Optimistic; one query shared across all cards. Disliking also shapes
 * future recommendations server-side (see lib/gifts/signals).
 */
export function useProductFeedback(enabled: boolean) {
  const supabase = createClient();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: KEY,
    enabled,
    staleTime: 1000 * 60 * 5,
    queryFn: async (): Promise<FeedbackMap> => {
      const { data, error } = await supabase
        .from("product_feedback")
        .select("product_id, signal");
      if (error) throw error;
      const map: FeedbackMap = {};
      for (const r of data ?? []) map[r.product_id] = r.signal as Signal;
      return map;
    },
  });

  const mutation = useMutation({
    mutationFn: async ({
      productId,
      signal,
    }: {
      productId: string;
      signal: Signal | null;
    }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (signal === null) {
        const { error } = await supabase
          .from("product_feedback")
          .delete()
          .eq("user_id", user.id)
          .eq("product_id", productId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("product_feedback").upsert(
          { user_id: user.id, product_id: productId, signal },
          { onConflict: "user_id,product_id" }
        );
        if (error) throw error;
      }
    },
    onMutate: async ({ productId, signal }) => {
      await qc.cancelQueries({ queryKey: KEY });
      const prev = qc.getQueryData<FeedbackMap>(KEY);
      qc.setQueryData<FeedbackMap>(KEY, (old = {}) => {
        const next = { ...old };
        if (signal === null) delete next[productId];
        else next[productId] = signal;
        return next;
      });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(KEY, ctx.prev);
    },
  });

  const feedback = query.data ?? {};
  const setFeedback = (productId: string, signal: Signal | null) =>
    mutation.mutate({ productId, signal });

  return { feedback, setFeedback };
}
