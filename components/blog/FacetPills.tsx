import Link from "next/link";

export type Facet = {
  _id: string;
  kind: string;
  slug: string;
  title: string | null;
};

/**
 * Grouped by kind so "who it's for" and "how much" read as separate axes rather
 * than one undifferentiated pile of tags.
 */
const KIND_ORDER = ["recipient", "occasion", "priceBand"] as const;

export default function FacetPills({
  facets,
  activeSlug,
  labels,
}: {
  facets: Facet[];
  activeSlug?: string;
  labels: Record<string, string>;
}) {
  if (facets.length === 0) return null;

  const groups = KIND_ORDER.map((kind) => ({
    kind,
    items: facets.filter((facet) => facet.kind === kind),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="flex flex-col gap-4">
      {groups.map(({ kind, items }) => (
        <div key={kind} className="flex flex-wrap items-center gap-2">
          <span className="text-base-content/45 mr-1 text-[11px] font-semibold tracking-[0.14em] uppercase">
            {labels[kind] ?? kind}
          </span>
          {items.map((facet) => {
            const isActive = facet.slug === activeSlug;
            return (
              <Link
                key={facet._id}
                href={`/blog/dovanos/${facet.slug}`}
                aria-current={isActive ? "page" : undefined}
                className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "border-primary bg-primary text-primary-content shadow-sm"
                    : "border-base-300 hover:border-primary hover:text-primary hover:-translate-y-0.5"
                }`}
              >
                {facet.title}
              </Link>
            );
          })}
        </div>
      ))}
    </div>
  );
}
