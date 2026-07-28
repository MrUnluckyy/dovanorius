import { ImagesIcon } from "@sanity/icons/Images";
import { defineArrayMember, defineField, defineType } from "sanity";

/** Several images shown together as a grid or a swipeable carousel. */
export const pteGalleryType = defineType({
  name: "pteGallery",
  title: "Image gallery",
  type: "object",
  icon: ImagesIcon,
  fields: [
    defineField({
      name: "images",
      type: "array",
      of: [
        defineArrayMember({
          type: "image",
          options: { hotspot: true },
          fields: [
            defineField({
              name: "alt",
              title: "Alternative text",
              type: "string",
              validation: (rule) =>
                rule.required().warning("Alt text is important for accessibility"),
            }),
            defineField({ name: "caption", type: "string" }),
          ],
        }),
      ],
      validation: (rule) => rule.min(2).error("A gallery needs at least two images"),
    }),
    defineField({
      name: "display",
      title: "Display as",
      type: "string",
      options: {
        list: [
          { title: "Grid", value: "grid" },
          { title: "Carousel — swipe horizontally", value: "carousel" },
        ],
        layout: "radio",
      },
      initialValue: "grid",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "columns",
      title: "Grid columns",
      type: "number",
      description: "Only applies to the grid display",
      options: { list: [2, 3, 4], layout: "radio", direction: "horizontal" },
      initialValue: 3,
      hidden: ({ parent }) => parent?.display !== "grid",
    }),
  ],
  preview: {
    select: { images: "images", display: "display", media: "images.0" },
    prepare({ images, display, media }) {
      const count = Array.isArray(images) ? images.length : 0;
      return {
        title: `${count} image${count === 1 ? "" : "s"}`,
        subtitle: `Gallery · ${display === "carousel" ? "Carousel" : "Grid"}`,
        media: media ?? ImagesIcon,
      };
    },
  },
});
