import type { SchemaTypeDefinition } from "sanity";

import { authorType } from "./author";
import { blockContentType } from "./blockContent";
import { pteCalloutType } from "./blocks/pteCallout";
import { pteGalleryType } from "./blocks/pteGallery";
import { pteGiftPicksType } from "./blocks/pteGiftPicks";
import { pteImageType } from "./blocks/pteImage";
import { categoryType } from "./category";
import { giftFacetType } from "./giftFacet";
import { localeType } from "./locale";
import { postType } from "./post";

export const schemaTypes: SchemaTypeDefinition[] = [
  // Documents
  postType,
  authorType,
  categoryType,
  giftFacetType,
  localeType,
  // Rich text
  blockContentType,
  // Body blocks
  pteImageType,
  pteGalleryType,
  pteCalloutType,
  pteGiftPicksType,
];
