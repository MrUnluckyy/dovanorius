import { defineArrayMember, defineType } from "sanity";

/**
 * The rich-text type used for article bodies. Registered with
 * `internationalizedArray` so each post gets one body per locale.
 */
export const blockContentType = defineType({
  name: "blockContent",
  title: "Block content",
  type: "array",
  of: [
    defineArrayMember({
      type: "block",
      styles: [
        { title: "Normal", value: "normal" },
        { title: "Heading 2", value: "h2" },
        { title: "Heading 3", value: "h3" },
        { title: "Quote", value: "blockquote" },
      ],
      lists: [
        { title: "Bulleted", value: "bullet" },
        { title: "Numbered", value: "number" },
      ],
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
            fields: [
              {
                name: "href",
                type: "url",
                title: "URL",
                validation: (rule) =>
                  rule.uri({
                    scheme: ["http", "https", "mailto"],
                    allowRelative: true,
                  }),
              },
              {
                name: "openInNewTab",
                type: "boolean",
                title: "Open in new tab",
                initialValue: false,
              },
            ],
          },
        ],
      },
    }),
    defineArrayMember({ type: "pteImage" }),
    defineArrayMember({ type: "pteGallery" }),
    defineArrayMember({ type: "pteCallout" }),
    defineArrayMember({ type: "pteGiftPicks" }),
  ],
});
