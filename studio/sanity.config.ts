import { visionTool } from "@sanity/vision";
import { defineConfig } from "sanity";
import { presentationTool } from "sanity/presentation";
import { structureTool } from "sanity/structure";
import { internationalizedArray } from "sanity-plugin-internationalized-array";

import { schemaTypes } from "./schemaTypes";

// Where the Next.js app is running. Override with SANITY_STUDIO_PREVIEW_ORIGIN
// in studio/.env when pointing the Studio at a deployed site.
const previewOrigin =
  process.env.SANITY_STUDIO_PREVIEW_ORIGIN ?? "http://localhost:3000";

export default defineConfig({
  name: "default",
  title: "Dovanorius",

  projectId: "d46477b3",
  dataset: "production",

  plugins: [
    structureTool(),
    // Side-by-side editing: the real page renders in an iframe and any text in
    // it is click-to-edit.
    presentationTool({
      previewUrl: {
        origin: previewOrigin,
        preview: "/blog",
        previewMode: {
          enable: "/api/draft-mode/enable",
          disable: "/api/draft-mode/disable",
        },
      },
    }),
    visionTool(),
    // Field-level localisation. Languages are read from the `locale` documents
    // so editors can manage them without a code change.
    internationalizedArray({
      languages: (client) =>
        client.fetch(`*[_type == "locale"] | order(isDefault desc, tag asc){
          "id": tag,
          "title": name
        }`),
      defaultLanguages: ["lt"],
      fieldTypes: ["string", "text", "blockContent"],
    }),
  ],

  schema: {
    types: schemaTypes,
  },
});
