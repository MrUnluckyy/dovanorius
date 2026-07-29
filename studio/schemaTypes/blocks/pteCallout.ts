import { InfoOutlineIcon } from "@sanity/icons/InfoOutline";
import { defineArrayMember, defineField, defineType } from "sanity";

/** A highlighted aside — a tip, a warning, or a note. */
export const pteCalloutType = defineType({
  name: "pteCallout",
  title: "Callout",
  type: "object",
  icon: InfoOutlineIcon,
  fields: [
    defineField({
      name: "tone",
      type: "string",
      options: {
        list: [
          { title: "Info", value: "info" },
          { title: "Tip", value: "tip" },
          { title: "Warning", value: "warning" },
        ],
        layout: "radio",
      },
      initialValue: "info",
      validation: (rule) => rule.required(),
    }),
    defineField({ name: "title", type: "string" }),
    defineField({
      name: "content",
      type: "array",
      of: [
        defineArrayMember({
          type: "block",
          // Deliberately limited: a callout is a short aside, not a subdocument.
          styles: [{ title: "Normal", value: "normal" }],
          lists: [{ title: "Bulleted", value: "bullet" }],
          marks: {
            decorators: [
              { title: "Strong", value: "strong" },
              { title: "Emphasis", value: "em" },
            ],
            annotations: [
              {
                name: "link",
                type: "object",
                title: "Link",
                fields: [{ name: "href", type: "url", title: "URL" }],
              },
            ],
          },
        }),
      ],
      validation: (rule) => rule.required(),
    }),
  ],
  preview: {
    select: { title: "title", tone: "tone" },
    prepare({ title, tone }) {
      const label = tone ? tone[0].toUpperCase() + tone.slice(1) : "Info";
      return {
        title: title || label,
        subtitle: `Callout · ${label}`,
        media: InfoOutlineIcon,
      };
    },
  },
});
