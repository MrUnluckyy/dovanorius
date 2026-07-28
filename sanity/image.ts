import {
  createImageUrlBuilder,
  type SanityImageSource,
} from "@sanity/image-url";

import { dataset, projectId } from "./client";

const builder = createImageUrlBuilder({ projectId, dataset });

/**
 * Build a Sanity CDN URL for an image. Honours the hotspot/crop the editor set
 * in the Studio, and the CDN negotiates WebP/AVIF automatically.
 */
export function urlFor(source: SanityImageSource) {
  return builder.image(source);
}
