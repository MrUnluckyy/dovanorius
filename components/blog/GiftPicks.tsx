import { stegaClean } from "next-sanity";

import SanityImage, { type SanityImageValue } from "@/components/SanityImage";

export type GiftPick = {
  _key: string;
  title?: string;
  image?: SanityImageValue | null;
  description?: string;
  price?: string;
  url?: string;
  ctaLabel?: string;
};

export type GiftPicksValue = {
  heading?: string;
  items?: GiftPick[] | null;
  sponsored?: boolean;
  display?: string;
};

export default function GiftPicks({
  value,
  defaultCtaLabel,
}: {
  value: GiftPicksValue;
  defaultCtaLabel: string;
}) {
  const items = value?.items ?? [];
  if (items.length === 0) return null;

  // Affiliate links must be declared to search engines.
  const rel = value.sponsored
    ? "sponsored nofollow noopener noreferrer"
    : "noopener noreferrer";

  const numbered = stegaClean(value.display) === "numbered";

  return (
    <section className="my-10 sm:-mx-12 lg:-mx-24">
      {value.heading && (
        <h2 className="mb-4 text-2xl font-bold">{value.heading}</h2>
      )}

      {numbered ? (
        <ol className="space-y-6">
          {items.map((item, index) => (
            <li
              key={item._key}
              className="card bg-base-100 shadow-sm sm:card-side"
            >
              {item.image?.asset && (
                <figure className="sm:w-56 sm:shrink-0">
                  <SanityImage
                    value={item.image}
                    width={448}
                    height={448}
                    sizes="(max-width: 640px) 100vw, 224px"
                    className="h-48 w-full object-cover sm:h-full"
                  />
                </figure>
              )}
              <div className="card-body gap-2">
                <h3 className="card-title items-start text-lg">
                  <span
                    className="badge badge-primary badge-lg shrink-0"
                    aria-hidden
                  >
                    {index + 1}
                  </span>
                  <span>{item.title}</span>
                </h3>
                {item.description && (
                  <p className="text-sm opacity-70">{item.description}</p>
                )}
                <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                  {item.price && (
                    <span className="font-semibold">{item.price}</span>
                  )}
                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel={rel}
                      className="btn btn-primary btn-sm"
                    >
                      {item.ctaLabel || defaultCtaLabel}
                    </a>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <li key={item._key} className="card bg-base-100 shadow-sm">
              {item.image?.asset && (
                <figure className="aspect-square overflow-hidden">
                  <SanityImage
                    value={item.image}
                    width={500}
                    height={500}
                    sizes="(max-width: 640px) 100vw, 33vw"
                    className="h-full w-full object-cover"
                  />
                </figure>
              )}
              <div className="card-body gap-2 p-4">
                <h3 className="card-title text-base">{item.title}</h3>
                {item.description && (
                  <p className="text-sm opacity-70">{item.description}</p>
                )}
                <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                  {item.price && (
                    <span className="font-semibold">{item.price}</span>
                  )}
                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel={rel}
                      className="btn btn-primary btn-sm"
                    >
                      {item.ctaLabel || defaultCtaLabel}
                    </a>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
