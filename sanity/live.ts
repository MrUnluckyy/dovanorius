import { defineLive } from "next-sanity/live";

import { client } from "./client";

/**
 * `sanityFetch` returns published content normally, and draft content when
 * Next.js draft mode is on (which the Presentation tool enables). `SanityLive`
 * subscribes to changes so edits appear without a reload.
 *
 * The read token reaches the browser only while draft mode is active.
 */
export const { sanityFetch, SanityLive } = defineLive({
  client: client.withConfig({
    // defineLive manages the perspective itself; pinning it here would
    // stop drafts from ever resolving.
    perspective: undefined,
  }),
  serverToken: process.env.SANITY_API_READ_TOKEN,
  browserToken: process.env.SANITY_API_READ_TOKEN,
});
