/**
 * Creates one sample post so the /blog routes can be smoke-tested end to end.
 * Safe to delete in the Studio afterwards.
 * Run: `cd studio && set -a && . ./.env && set +a && node scripts/seed-sample-post.mjs`
 */
import { createClient } from "@sanity/client";

const client = createClient({
  projectId: "d46477b3",
  dataset: "production",
  apiVersion: "2026-07-01",
  token: process.env.SANITY_AUTH_TOKEN,
  useCdn: false,
});

const i18n = (type, values) =>
  Object.entries(values).map(([key, value]) => ({
    _key: key,
    _type: `internationalizedArray${type}Value`,
    value,
  }));

const paragraph = (text) => ({
  _type: "block",
  _key: Math.random().toString(36).slice(2, 10),
  style: "normal",
  markDefs: [],
  children: [{ _type: "span", _key: "s0", text, marks: [] }],
});

const post = {
  _id: "sample-post-hello-world",
  _type: "post",
  slug: { _type: "slug", current: "sveiki-atvyke" },
  publishedAt: new Date().toISOString(),
  title: i18n("String", {
    lt: "Sveiki atvykę į Noriuto tinklaraštį",
    en: "Welcome to the Noriuto blog",
  }),
  excerpt: i18n("Text", {
    lt: "Pirmasis įrašas — patikrinimui, kad viskas veikia.",
    en: "A first post, here to confirm the pipeline works.",
  }),
  body: i18n("BlockContent", {
    lt: [
      paragraph("Šis įrašas sukurtas automatiškai, kad būtų galima patikrinti tinklaraščio veikimą."),
      paragraph("Jį galima saugiai ištrinti Sanity Studio aplinkoje."),
    ],
    en: [
      paragraph("This post was created automatically to verify the blog renders correctly."),
      paragraph("You can safely delete it from the Sanity Studio."),
    ],
  }),
};

await client.createOrReplace(post);
console.log(`Created sample post at /blog/${post.slug.current}`);
