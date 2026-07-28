import { defineEnableDraftMode } from "next-sanity/draft-mode";

import { client } from "@/sanity/client";

/**
 * Entered by the Studio's Presentation tool. The token check happens inside
 * `defineEnableDraftMode` — it validates the request against Sanity before
 * turning draft mode on.
 */
export const { GET } = defineEnableDraftMode({
  client: client.withConfig({ token: process.env.SANITY_API_READ_TOKEN }),
});
