import { z } from "zod";

/** LLM-inferred, cached per user. Drives catalog retrieval + ranking. */
export const TasteProfileSchema = z.object({
  summary: z.string(),
  /** Concrete English keywords for catalog retrieval, e.g. ["running","cycling"]. */
  interests: z.array(z.string()),
  categories: z.array(
    z.enum(["beauty", "shoes", "clothing", "bag", "accessory", "other"])
  ),
  brands: z.array(z.string()),
  price_min: z.number().nullable(),
  price_max: z.number().nullable(),
  /** The person's gender, for filtering the catalog. */
  gender: z.enum(["female", "male", "unisex"]).nullable(),
  /** Gifting-relevant context, e.g. ["parent of a young child"]. */
  life_context: z.array(z.string()),
});
export type TasteProfile = z.infer<typeof TasteProfileSchema>;

/** The ranker returns only ids + reasons; we own the product facts. */
export const PicksSchema = z.object({
  picks: z.array(
    z.object({ product_id: z.string(), reason: z.string() })
  ),
});
export type Picks = z.infer<typeof PicksSchema>;
