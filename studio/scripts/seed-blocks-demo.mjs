/**
 * Creates a post exercising every body block, for smoke-testing the frontend.
 * Safe to delete in the Studio afterwards.
 * Run: `cd studio && set -a && . ./.env && set +a && node scripts/seed-blocks-demo.mjs`
 */
import { createClient } from "@sanity/client";

const client = createClient({
  projectId: "d46477b3",
  dataset: "production",
  apiVersion: "2026-07-01",
  token: process.env.SANITY_AUTH_TOKEN,
  useCdn: false,
});

const key = () => Math.random().toString(36).slice(2, 12);

const para = (text) => ({
  _type: "block",
  _key: key(),
  style: "normal",
  markDefs: [],
  children: [{ _type: "span", _key: key(), text, marks: [] }],
});

// Upload a placeholder image so the image blocks have a real asset.
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);
const asset = await client.assets.upload("image", png, { filename: "placeholder.png" });
const imageRef = { _type: "image", asset: { _type: "reference", _ref: asset._id } };

const body = [
  para("Below are the four body blocks, each rendered by its own component."),
  { _type: "pteImage", _key: key(), ...{ image: imageRef }, alt: "Placeholder", caption: "Inline image", layout: "inline" },
  para("This paragraph sits beside a floated image."),
  { _type: "pteImage", _key: key(), image: imageRef, alt: "Placeholder", caption: "Floated right", layout: "right" },
  para("Text wraps around the floated image until it clears."),
  {
    _type: "pteGallery",
    _key: key(),
    display: "grid",
    columns: 3,
    images: [
      { ...imageRef, _key: key(), alt: "One", caption: "First" },
      { ...imageRef, _key: key(), alt: "Two", caption: "Second" },
    ],
  },
  {
    _type: "pteCallout",
    _key: key(),
    tone: "tip",
    title: "A helpful tip",
    content: [para("Callouts render with DaisyUI alert styling.")],
  },
  {
    _type: "pteGiftPicks",
    _key: key(),
    heading: "Our picks",
    sponsored: true,
    items: [
      {
        _key: key(),
        title: "A thoughtful gift",
        image: imageRef,
        description: "Short blurb about why this is a good pick.",
        price: "20–30 €",
        url: "https://example.com/gift",
      },
    ],
  },
];

await client.createOrReplace({
  _id: "sample-post-blocks-demo",
  _type: "post",
  slug: { _type: "slug", current: "bloku-demo" },
  publishedAt: new Date().toISOString(),
  title: [
    { _key: "lt", _type: "internationalizedArrayStringValue", value: "Blokų demonstracija" },
    { _key: "en", _type: "internationalizedArrayStringValue", value: "Block demo" },
  ],
  body: [
    { _key: "lt", _type: "internationalizedArrayBlockContentValue", value: body },
    { _key: "en", _type: "internationalizedArrayBlockContentValue", value: body },
  ],
});

console.log("Created /blog/bloku-demo");
