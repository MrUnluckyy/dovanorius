import { DocumentTextIcon } from "@sanity/icons/DocumentText";
import { defineField, defineType } from "sanity";

/**
 * Field-level localisation: one document per article, with `lt` and `en`
 * variants of each translatable field. Slug, cover image, author, categories
 * and publish date are shared across locales.
 */
export const postType = defineType({
  name: "post",
  title: "Post",
  type: "document",
  icon: DocumentTextIcon,
  groups: [
    { name: "content", title: "Content", default: true },
    { name: "meta", title: "Metadata" },
    { name: "seo", title: "SEO" },
  ],
  fields: [
    defineField({
      name: "title",
      type: "internationalizedArrayString",
      group: "content",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "slug",
      type: "slug",
      description: "Shared across locales — this is the /blog/<slug> segment",
      group: "content",
      options: { maxLength: 96 },
      validation: (rule) =>
        rule.required().custom(async (slug, context) => {
          if (!slug?.current) return "Required";
          if (!/^[a-z0-9-]+$/.test(slug.current)) {
            return "Slug must be lowercase letters, numbers and hyphens only";
          }
          const client = context.getClient({ apiVersion: "2026-07-01" });
          const id = context.document?._id?.replace(/^drafts\./, "");
          const duplicates = await client.fetch<number>(
            `count(*[_type == "post" && slug.current == $slug && !(_id in [$id, "drafts." + $id])])`,
            { slug: slug.current, id }
          );
          return duplicates === 0 || "Another post already uses this slug";
        }),
    }),
    defineField({
      name: "excerpt",
      description: "Short summary shown in listings and used as the meta description fallback",
      type: "internationalizedArrayText",
      group: "content",
    }),
    defineField({
      name: "coverImage",
      type: "image",
      group: "content",
      options: { hotspot: true },
      fields: [
        defineField({
          name: "alt",
          title: "Alternative text",
          type: "string",
          validation: (rule) =>
            rule.required().warning("Alt text is important for accessibility and SEO"),
        }),
      ],
    }),
    defineField({
      name: "body",
      type: "internationalizedArrayBlockContent",
      group: "content",
    }),
    defineField({
      name: "publishedAt",
      title: "Published at",
      type: "datetime",
      group: "meta",
      initialValue: () => new Date().toISOString(),
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "author",
      type: "reference",
      group: "meta",
      to: [{ type: "author" }],
    }),
    defineField({
      name: "categories",
      type: "array",
      group: "meta",
      of: [{ type: "reference", to: [{ type: "category" }] }],
      validation: (rule) => rule.unique(),
    }),
    defineField({
      name: "facets",
      title: "Gift facets",
      description:
        "Which recipient / occasion / price landing pages this guide belongs on",
      type: "array",
      group: "meta",
      of: [{ type: "reference", to: [{ type: "giftFacet" }] }],
      validation: (rule) => rule.unique(),
    }),
    defineField({
      name: "seo",
      title: "SEO overrides",
      description: "Leave empty to fall back to the title and excerpt above",
      type: "object",
      group: "seo",
      options: { collapsible: true, collapsed: true },
      fields: [
        defineField({ name: "metaTitle", type: "internationalizedArrayString" }),
        defineField({ name: "metaDescription", type: "internationalizedArrayText" }),
        defineField({
          name: "noIndex",
          title: "Hide from search engines",
          type: "boolean",
          initialValue: false,
        }),
      ],
    }),
  ],
  orderings: [
    {
      title: "Published, newest first",
      name: "publishedAtDesc",
      by: [{ field: "publishedAt", direction: "desc" }],
    },
  ],
  preview: {
    select: {
      title: "title.0.value",
      subtitle: "slug.current",
      media: "coverImage",
    },
  },
});
