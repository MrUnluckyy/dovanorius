import { FilterIcon } from "@sanity/icons/Filter";
import { defineField, defineType } from "sanity";

export const FACET_KINDS = [
  { title: "Recipient — who it's for", value: "recipient" },
  { title: "Occasion — what it's for", value: "occasion" },
  { title: "Price band", value: "priceBand" },
] as const;

/**
 * The searchable dimension of the gift guides. Each facet gets its own landing
 * page at /blog/dovanos/<slug> — that page, not the individual article, is what
 * ranks for queries like "dovanos vaikinui".
 */
export const giftFacetType = defineType({
  name: "giftFacet",
  title: "Gift facet",
  type: "document",
  icon: FilterIcon,
  fields: [
    defineField({
      name: "kind",
      title: "Facet type",
      type: "string",
      options: { list: [...FACET_KINDS], layout: "radio" },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "title",
      type: "internationalizedArrayString",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "slug",
      type: "slug",
      description: "URL segment, e.g. vaikinui → /blog/dovanos/vaikinui",
      options: { maxLength: 96 },
      validation: (rule) =>
        rule.required().custom((slug) => {
          if (!slug?.current) return "Required";
          return /^[a-z0-9-]+$/.test(slug.current)
            ? true
            : "Lowercase letters, numbers and hyphens only";
        }),
    }),
    defineField({
      name: "intro",
      title: "Landing page intro",
      description: "Shown above the article list. This is the page's ranking copy.",
      type: "internationalizedArrayBlockContent",
    }),
    defineField({
      name: "coverImage",
      type: "image",
      options: { hotspot: true },
      fields: [defineField({ name: "alt", title: "Alternative text", type: "string" })],
    }),
    defineField({
      name: "seo",
      title: "SEO overrides",
      type: "object",
      options: { collapsible: true, collapsed: true },
      fields: [
        defineField({ name: "metaTitle", type: "internationalizedArrayString" }),
        defineField({ name: "metaDescription", type: "internationalizedArrayText" }),
      ],
    }),
    defineField({
      name: "featured",
      title: "Show on the blog index",
      type: "boolean",
      initialValue: true,
    }),
    defineField({
      name: "order",
      title: "Sort order",
      type: "number",
      initialValue: 100,
    }),
  ],
  orderings: [
    {
      title: "Kind, then order",
      name: "kindOrder",
      by: [
        { field: "kind", direction: "asc" },
        { field: "order", direction: "asc" },
      ],
    },
  ],
  preview: {
    select: { title: "title.0.value", slug: "slug.current", kind: "kind", media: "coverImage" },
    prepare({ title, slug, kind, media }) {
      const label = FACET_KINDS.find((k) => k.value === kind)?.title ?? kind;
      return {
        title: title || slug || "Untitled facet",
        subtitle: label,
        media: media ?? FilterIcon,
      };
    },
  },
});
