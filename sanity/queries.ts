import { defineQuery } from "next-sanity";

/**
 * Posts use field-level localisation via `sanity-plugin-internationalized-array`.
 * v5 stores the locale on a `language` field; older (v4) items kept it in `_key`.
 * Every read matches both so the data migration can happen independently.
 * `localized()` picks the requested locale and falls back to Lithuanian.
 */
const localized = (field: string) =>
  `coalesce(${field}[language == $locale || _key == $locale][0].value, ${field}[language == "lt" || _key == "lt"][0].value)`;

const imageFragment = /* groq */ `
  "alt": alt,
  hotspot,
  crop,
  asset->{
    _id,
    url,
    metadata { lqip, dimensions { width, height } }
  }
`;

/**
 * Body blocks carry raw image references, so the asset (and its LQIP) has to be
 * expanded per block type or the blur placeholders come back undefined.
 */
const bodyProjection = /* groq */ `[]{
  ...,
  _type == "pteImage" => {
    ...,
    image { ${imageFragment} }
  },
  _type == "pteGallery" => {
    ...,
    images[]{ ${imageFragment}, _key, caption }
  },
  _type == "pteGiftPicks" => {
    ...,
    items[]{ ..., image { ${imageFragment} } }
  }
}`;

/** A localised rich-text field, with nested block assets expanded in both branches. */
const localizedBody = (field: string) => /* groq */ `coalesce(
  ${field}[language == $locale || _key == $locale][0].value${bodyProjection},
  ${field}[language == "lt" || _key == "lt"][0].value${bodyProjection}
)`;

/**
 * Rough reading time in minutes: characters / 5 ≈ words, at 200 wpm.
 * `pt::text()` flattens Portable Text to a plain string inside GROQ.
 */
const readingTime = (field: string) => /* groq */ `round(
  length(pt::text(coalesce(${field}[language == $locale || _key == $locale][0].value, ${field}[language == "lt" || _key == "lt"][0].value))) / 5 / 200
)`;

export const POSTS_QUERY = defineQuery(/* groq */ `
  *[_type == "post" && defined(slug.current) && publishedAt <= now()]
    | order(publishedAt desc)[$start...$end]{
      _id,
      "slug": slug.current,
      publishedAt,
      "title": ${localized("title")},
      "excerpt": ${localized("excerpt")},
      coverImage { ${imageFragment} },
      "readingTime": ${readingTime("body")},
      author->{ name, "slug": slug.current },
      categories[]->{ "slug": slug.current, "title": ${localized("title")} }
    }
`);

export const POSTS_COUNT_QUERY = defineQuery(/* groq */ `
  count(*[_type == "post" && defined(slug.current) && publishedAt <= now()])
`);

export const POST_QUERY = defineQuery(/* groq */ `
  *[_type == "post" && slug.current == $slug][0]{
    _id,
    "slug": slug.current,
    publishedAt,
    _updatedAt,
    "title": ${localized("title")},
    "excerpt": ${localized("excerpt")},
    coverImage { ${imageFragment} },
    "body": ${localizedBody("body")},
    "readingTime": ${readingTime("body")},
    author->{
      name,
      "slug": slug.current,
      image { ${imageFragment} },
      "bio": ${localized("bio")}
    },
    categories[]->{ "slug": slug.current, "title": ${localized("title")} },
    seo {
      "metaTitle": ${localized("metaTitle")},
      "metaDescription": ${localized("metaDescription")},
      noIndex
    }
  }
`);

export const POST_SLUGS_QUERY = defineQuery(/* groq */ `
  *[_type == "post" && defined(slug.current) && publishedAt <= now()].slug.current
`);

/** Facets shown as internal links on the blog index. */
export const FEATURED_FACETS_QUERY = defineQuery(/* groq */ `
  *[_type == "giftFacet" && featured == true] | order(kind asc, order asc){
    _id,
    kind,
    "slug": slug.current,
    "title": ${localized("title")}
  }
`);

export const FACET_QUERY = defineQuery(/* groq */ `
  *[_type == "giftFacet" && slug.current == $facet][0]{
    _id,
    kind,
    "slug": slug.current,
    "title": ${localized("title")},
    "intro": ${localizedBody("intro")},
    coverImage { ${imageFragment} },
    seo {
      "metaTitle": ${localized("metaTitle")},
      "metaDescription": ${localized("metaDescription")}
    }
  }
`);

/** Posts tagged with a facet. Filters on _ref, never a resolved join. */
export const FACET_POSTS_QUERY = defineQuery(/* groq */ `
  *[_type == "post" && defined(slug.current) && publishedAt <= now()
    && $facetId in facets[]._ref]
    | order(publishedAt desc)[$start...$end]{
      _id,
      "slug": slug.current,
      publishedAt,
      "title": ${localized("title")},
      "excerpt": ${localized("excerpt")},
      coverImage { ${imageFragment} },
      "readingTime": ${readingTime("body")},
      author->{ name, "slug": slug.current }
    }
`);

export const FACET_POSTS_COUNT_QUERY = defineQuery(/* groq */ `
  count(*[_type == "post" && defined(slug.current) && publishedAt <= now()
    && $facetId in facets[]._ref])
`);

export const FACET_SLUGS_QUERY = defineQuery(/* groq */ `
  *[_type == "giftFacet" && defined(slug.current)].slug.current
`);

/** Sitemap: published posts, newest first, with a date for `lastModified`. */
export const SITEMAP_POSTS_QUERY = defineQuery(/* groq */ `
  *[_type == "post" && defined(slug.current) && publishedAt <= now()]
    | order(publishedAt desc){
      "slug": slug.current,
      publishedAt,
      _updatedAt
    }
`);

/**
 * Sitemap: only facets that actually have a post behind them.
 *
 * `FACET_SLUGS_QUERY` returns every facet, and most of them currently list
 * nothing — submitting empty listing pages just spends crawl budget on pages
 * Google will decline to index. They come back into the sitemap on their own as
 * soon as a post is tagged with them.
 */
export const SITEMAP_FACETS_QUERY = defineQuery(/* groq */ `
  *[_type == "giftFacet" && defined(slug.current)
    && count(*[_type == "post" && defined(slug.current) && publishedAt <= now()
      && ^._id in facets[]._ref]) > 0]{
      "slug": slug.current,
      "lastModified": *[_type == "post" && defined(slug.current)
        && publishedAt <= now() && ^._id in facets[]._ref]
        | order(_updatedAt desc)[0]._updatedAt
    }
`);
