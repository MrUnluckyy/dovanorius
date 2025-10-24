"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Collection labels
const PLURAL_LABEL: Record<string, string> = {
  boards: "Wish Boards",
  "wish-boards": "Wish Boards",
};

// Detail-page (singular) labels
const SINGULAR_LABEL: Record<string, string> = {
  boards: "Board",
  "wish-boards": "Wish Board",
};

const isLikelyId = (seg: string) =>
  /^\d+$/.test(seg) || /^[0-9a-fA-F-]{6,}$/.test(seg);

// remove trailing slug IDs like `cycling-d093c0af`
const stripSlugSuffix = (seg: string) => seg.replace(/-[0-9a-fA-F]{6,}$/, "");

const prettify = (seg: string) =>
  seg.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export default function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  const cleanSegments = segments.map((seg, i) => {
    if (isLikelyId(seg)) {
      const parent = segments[i - 1]?.toLowerCase();
      return SINGULAR_LABEL[parent] ?? "Item";
    }

    // Slugs → clean suffix
    const clean = stripSlugSuffix(seg.toLowerCase());
    if (PLURAL_LABEL[clean]) return PLURAL_LABEL[clean];
    return prettify(clean);
  });

  return (
    <div className="text-sm breadcrumbs mt-4">
      <ul>
        <li>
          <Link href="/">Home</Link>
        </li>

        {cleanSegments.map((label, i) => {
          const href = "/" + segments.slice(0, i + 1).join("/");
          const isLast = i === cleanSegments.length - 1;
          return (
            <li key={href}>
              {isLast ? (
                <span className="font-semibold text-base-content">{label}</span>
              ) : (
                <Link href={href} className="hover:text-base-content">
                  {label}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
