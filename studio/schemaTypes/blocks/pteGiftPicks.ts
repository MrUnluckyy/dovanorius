import { PackageIcon } from "@sanity/icons/Package";
import { defineArrayMember, defineField, defineType } from "sanity";

/**
 * A card list of gift suggestions. `url` takes the outbound link, so Awin
 * affiliate URLs can be pasted straight in.
 */
export const pteGiftPicksType = defineType({
  name: "pteGiftPicks",
  title: "Gift picks",
  type: "object",
  icon: PackageIcon,
  fields: [
    defineField({ name: "heading", type: "string" }),
    defineField({
      name: "display",
      title: "Display as",
      type: "string",
      options: {
        list: [
          { title: "Vertical — image on top, card grid", value: "cards" },
          { title: "Horizontal — image beside text, stacked rows", value: "list" },
          { title: "Numbered — ranked rows", value: "numbered" },
          { title: "Feature — large editorial blocks", value: "feature" },
        ],
        layout: "radio",
      },
      description:
        'Vertical vs horizontal control where the image sits per item. Images are optional — every layout adapts to text-only picks. Use "numbered" for ranked listicles and "feature" for an editorial article-style layout with more text per item.',
      initialValue: "cards",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "items",
      type: "array",
      of: [
        defineArrayMember({
          type: "object",
          name: "giftPick",
          fields: [
            defineField({
              name: "title",
              type: "string",
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: "image",
              type: "image",
              options: { hotspot: true },
              fields: [
                defineField({ name: "alt", title: "Alternative text", type: "string" }),
              ],
            }),
            defineField({
              name: "description",
              type: "text",
              rows: 3,
              validation: (rule) => rule.max(240).warning("Keep blurbs short"),
            }),
            defineField({
              name: "price",
              type: "string",
              description: 'Free text so ranges work, e.g. "20–30 €"',
            }),
            defineField({
              name: "url",
              title: "Link",
              type: "url",
              validation: (rule) => rule.uri({ scheme: ["http", "https"] }),
            }),
            defineField({
              name: "ctaLabel",
              title: "Button label",
              type: "string",
              description: 'Defaults to "View" / "Žiūrėti" when empty',
            }),
          ],
          preview: {
            select: { title: "title", subtitle: "price", media: "image" },
          },
        }),
      ],
      validation: (rule) => rule.min(1).error("Add at least one gift pick"),
    }),
    defineField({
      name: "sponsored",
      title: "Contains affiliate links",
      description: 'Adds rel="sponsored nofollow" to the links',
      type: "boolean",
      initialValue: true,
    }),
  ],
  preview: {
    select: { heading: "heading", items: "items", media: "items.0.image" },
    prepare({ heading, items, media }) {
      const count = Array.isArray(items) ? items.length : 0;
      return {
        title: heading || "Gift picks",
        subtitle: `Gift picks · ${count} item${count === 1 ? "" : "s"}`,
        media: media ?? PackageIcon,
      };
    },
  },
});
