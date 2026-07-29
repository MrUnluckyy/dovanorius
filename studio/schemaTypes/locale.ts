import { TranslateIcon } from "@sanity/icons/Translate";
import { defineField, defineType } from "sanity";

/**
 * Locales live in the Content Lake rather than in code so the Studio and the
 * frontend read the same list. Seeded with `lt` (default) and `en` to match
 * `messages/lt.json` / `messages/en.json`.
 */
export const localeType = defineType({
  name: "locale",
  title: "Locale",
  type: "document",
  icon: TranslateIcon,
  fields: [
    defineField({
      name: "name",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "tag",
      type: "string",
      description: 'IANA language tag, e.g. "lt" or "en"',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "isDefault",
      title: "Default locale",
      type: "boolean",
      initialValue: false,
    }),
  ],
  preview: {
    select: { title: "name", subtitle: "tag" },
  },
});
