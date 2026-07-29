import { TagIcon } from "@sanity/icons/Tag";
import { defineField, defineType } from "sanity";

export const categoryType = defineType({
  name: "category",
  title: "Category",
  type: "document",
  icon: TagIcon,
  fields: [
    defineField({
      name: "title",
      type: "internationalizedArrayString",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "slug",
      type: "slug",
      description: "Shared across locales — used in /blog URLs",
      options: { maxLength: 96 },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "description",
      type: "internationalizedArrayText",
    }),
  ],
  preview: {
    // Show the Lithuanian title in lists; fall back to the slug.
    select: { title: "title.0.value", subtitle: "slug.current" },
  },
});
