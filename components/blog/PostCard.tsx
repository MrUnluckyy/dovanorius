import Link from "next/link";

import CoverFallback from "@/components/blog/CoverFallback";
import SanityImage, { type SanityImageValue } from "@/components/SanityImage";

export type PostCardData = {
  _id: string;
  slug: string;
  publishedAt: string;
  title: string | null;
  excerpt: string | null;
  coverImage?: SanityImageValue | null;
  readingTime?: number | null;
  author?: { name: string; slug: string } | null;
  categories?: { slug: string; title: string | null }[] | null;
};

function formatDate(iso: string, locale: string) {
  return new Date(iso).toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * `featured` renders the lead story as a wide two-column card; everything else
 * uses the compact vertical card. Breaking the uniform grid gives the index a
 * focal point.
 */
export default function PostCard({
  post,
  locale,
  minutesLabel,
  featured = false,
  index = 0,
}: {
  post: PostCardData;
  locale: string;
  minutesLabel: string;
  featured?: boolean;
  index?: number;
}) {
  const meta = (
    <div className="text-base-content/55 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      <time dateTime={post.publishedAt}>
        {formatDate(post.publishedAt, locale)}
      </time>
      {/* Short posts round down to 0 minutes; floor at 1 so it still reads. */}
      {post.readingTime != null && (
        <>
          <span aria-hidden>·</span>
          <span>
            {Math.max(1, post.readingTime)} {minutesLabel}
          </span>
        </>
      )}
      {post.author?.name && (
        <>
          <span aria-hidden>·</span>
          <span>{post.author.name}</span>
        </>
      )}
    </div>
  );

  const cover = (sizes: string, className: string) =>
    post.coverImage?.asset ? (
      <SanityImage
        value={post.coverImage}
        width={featured ? 1000 : 640}
        height={featured ? 640 : 400}
        sizes={sizes}
        className={`${className} transition-transform duration-500 group-hover:scale-[1.04]`}
      />
    ) : (
      <CoverFallback
        seed={post.slug}
        label={post.title}
        className={`${className} transition-transform duration-500 group-hover:scale-[1.04]`}
      />
    );

  return (
    <article
      className="animate-fade-up h-full"
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
    >
      <Link
        href={`/blog/${post.slug}`}
        className={`group border-base-300/70 bg-base-100 hover:border-primary/40 block h-full overflow-hidden rounded-2xl border transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${
          featured ? "sm:grid sm:grid-cols-2 sm:items-stretch" : ""
        }`}
      >
        <div
          className={`overflow-hidden ${
            featured ? "aspect-[4/3] sm:h-full sm:aspect-auto" : "aspect-[16/10]"
          }`}
        >
          {cover(
            featured
              ? "(max-width: 640px) 100vw, 50vw"
              : "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw",
            "h-full w-full object-cover"
          )}
        </div>

        <div
          className={`flex flex-col gap-3 ${featured ? "p-6 sm:p-8" : "p-5"}`}
        >
          {post.categories && post.categories.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {post.categories.slice(0, 2).map((category) => (
                <span
                  key={category.slug}
                  className="bg-primary/10 text-primary rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase"
                >
                  {category.title}
                </span>
              ))}
            </div>
          )}

          <h3
            className={`font-heading group-hover:text-primary leading-tight font-bold text-balance transition-colors ${
              featured ? "text-2xl sm:text-3xl" : "text-lg"
            }`}
          >
            {post.title}
          </h3>

          {post.excerpt && (
            <p
              className={`text-base-content/70 text-sm leading-relaxed ${
                featured ? "line-clamp-4" : "line-clamp-3"
              }`}
            >
              {post.excerpt}
            </p>
          )}

          <div className="mt-auto pt-2">{meta}</div>
        </div>
      </Link>
    </article>
  );
}
