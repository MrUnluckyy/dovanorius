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

  const display = stegaClean(value.display);
  const numbered = display === "numbered";
  const feature = display === "feature";

  return (
    <section className="my-10 sm:-mx-12 lg:-mx-24">
      {value.heading && (
        <h2 className="mb-4 text-2xl font-bold">{value.heading}</h2>
      )}

      {feature ? (
        // Editorial layout: each pick is a full section — cover, title, a
        // longer blurb and a single link — with the image alternating sides so
        // it reads like an article, not an ad grid.
        <div className="space-y-14 sm:space-y-20">
          {items.map((item, index) => (
            <article
              key={item._key}
              className="grid items-center gap-6 sm:grid-cols-2 sm:gap-10"
            >
              {item.image?.asset && (
                <figure
                  className={`overflow-hidden rounded-2xl ${
                    index % 2 === 1 ? "sm:order-2" : ""
                  }`}
                >
                  <SanityImage
                    value={item.image}
                    width={800}
                    height={600}
                    sizes="(max-width: 640px) 100vw, 50vw"
                    className="aspect-[4/3] h-full w-full object-cover"
                  />
                </figure>
              )}
              <div className={index % 2 === 1 ? "sm:order-1" : ""}>
                <h3 className="text-2xl font-bold text-balance sm:text-[1.75rem]">
                  {item.title}
                </h3>
                {item.description && (
                  <p className="mt-3 leading-relaxed opacity-80">
                    {item.description}
                  </p>
                )}
                <div className="mt-6 flex items-center gap-4">
                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel={rel}
                      className="btn btn-primary"
                    >
                      {item.ctaLabel || defaultCtaLabel}
                    </a>
                  )}
                  {item.price && (
                    <span className="text-base-content/60 text-sm">
                      {item.price}
                    </span>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : numbered ? (
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
