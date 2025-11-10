"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";

const PLURAL_LABEL: Record<string, string> = {
  boards: "wishBoards",
  "wish-boards": "wishBoards",
  users: "users",
};

const SINGULAR_LABEL: Record<string, string> = {
  boards: "board",
  "wish-boards": "wishBoard",
  users: "userBoards",
};

const isLikelyId = (seg: string) =>
  /^\d+$/.test(seg) ||
  /^[0-9a-fA-F-]{6,}$/.test(seg) ||
  /^[0-9a-fA-F-]{8,}$/.test(seg); // allow UUID-like

// extract "slug" from patterns like "games--d78753fe" or "cycling-d093c0af"
const extractSlug = (seg: string) => {
  const lower = seg.toLowerCase();

  // double-hyphen separator first (preferred for custom slugs)
  const mDouble = lower.match(/^(.*?)[-]{2}[0-9a-fA-F-]{6,}$/);
  if (mDouble) return mDouble[1].replace(/[-_]+$/, "");

  // single-hyphen hex suffix fallback
  const mSingle = lower.match(/^(.*?)-[0-9a-fA-F]{6,}$/);
  if (mSingle) return mSingle[1].replace(/[-_]+$/, "");

  return lower;
};

const prettify = (seg: string) =>
  seg
    .replace(/[-_]+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());

export default function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  const t = useTranslations("Navbar");

  type Crumb = { label: string; href: string; translate: boolean };

  const crumbs: Crumb[] = segments.map((seg, i) => {
    const href = "/" + segments.slice(0, i + 1).join("/");
    const parent = segments[i - 1]?.toLowerCase();

    // 1) Detail page IDs → translate using singular label map
    if (isLikelyId(seg)) {
      const key = SINGULAR_LABEL[parent ?? ""] ?? "Item";
      return { label: key, href, translate: true };
    }

    // 2) Custom slug with ID suffix (games--abcd1234 or slug-abcdef)
    const base = extractSlug(seg);

    // 3) Known plural/collection labels → translate
    if (PLURAL_LABEL[base]) {
      return { label: PLURAL_LABEL[base], href, translate: true };
    }

    // 4) Everything else → show as plain text (no translation)
    return { label: prettify(base), href, translate: false };
  });

  return (
    <div className="text-sm breadcrumbs mt-4">
      <ul>
        <li>
          <Link href="/">Pagrindinis</Link>
        </li>

        {crumbs.map(({ label, href, translate }, i) => {
          const isLast = i === crumbs.length - 1;
          const content = translate ? t(label) : label;

          return (
            <li key={href}>
              {isLast ? (
                <span className="font-semibold text-base-content">
                  {content}
                </span>
              ) : (
                <Link href={href} className="hover:text-base-content">
                  {content}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
