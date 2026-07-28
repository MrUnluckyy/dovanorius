import { ImageIcon } from "@sanity/icons/Image";
import { defineField, defineType } from "sanity";

/** Layout options for images placed in an article body. */
export const IMAGE_LAYOUTS = [
  { title: "Full bleed — edge to edge", value: "full" },
  { title: "Wide — wider than the text", value: "wide" },
  { title: "Inline — matches text width", value: "inline" },
  { title: "Float left — text wraps on the right", value: "left" },
  { title: "Float right — text wraps on the left", value: "right" },
] as const;

/** An image embedded inside an article body. */
export const pteImageType = defineType({
  name: "pteImage",
  title: "Image",
  type: "object",
  icon: ImageIcon,
  fields: [
    defineField({
      name: "image",
      type: "image",
      options: { hotspot: true },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "alt",
      title: "Alternative text",
      description: "Describes the image for screen readers and search engines",
      type: "string",
      validation: (rule) =>
        rule.required().warning("Alt text is important for accessibility and SEO"),
    }),
    defineField({ name: "caption", type: "string" }),
    defineField({
      name: "layout",
      title: "Placement",
      type: "string",
      options: { list: [...IMAGE_LAYOUTS], layout: "radio" },
      initialValue: "inline",
      validation: (rule) => rule.required(),
    }),
  ],
  preview: {
    select: { caption: "caption", alt: "alt", layout: "layout", media: "image" },
    prepare({ caption, alt, layout, media }) {
      const label = IMAGE_LAYOUTS.find((l) => l.value === layout)?.title;
      return {
        title: caption || alt || "Image",
        subtitle: label ? `Image · ${label}` : "Image",
        media: media ?? ImageIcon,
      };
    },
  },
});
