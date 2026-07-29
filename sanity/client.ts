import { createClient } from "next-sanity";

export const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!;
export const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET!;
export const apiVersion =
  process.env.NEXT_PUBLIC_SANITY_API_VERSION ?? "2026-07-01";

export const client = createClient({
  projectId,
  dataset,
  apiVersion,
  // Published content only; drafts stay in the Studio.
  perspective: "published",
  useCdn: true,
});

/**
 * Bypasses the Sanity CDN. Use for `generateStaticParams` and anything that
 * must not read a few-seconds-stale value.
 */
export const freshClient = client.withConfig({ useCdn: false });
