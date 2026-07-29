/**
 * Seeds the `locale` documents the internationalizedArray plugin reads.
 * Run once: `cd studio && set -a && . ./.env && set +a && node scripts/seed-locales.mjs`
 */
import { createClient } from "@sanity/client";

const client = createClient({
  projectId: "d46477b3",
  dataset: "production",
  apiVersion: "2026-07-01",
  token: process.env.SANITY_AUTH_TOKEN,
  useCdn: false,
});

// Fixed IDs: these are configuration singletons, not editorial content.
const locales = [
  { _id: "locale-lt", _type: "locale", name: "Lietuvių", tag: "lt", isDefault: true },
  { _id: "locale-en", _type: "locale", name: "English", tag: "en", isDefault: false },
];

const tx = locales.reduce((t, doc) => t.createOrReplace(doc), client.transaction());
const result = await tx.commit();
console.log(`Seeded ${result.results.length} locale documents.`);
