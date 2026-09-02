/**
 * The generic body used by route-level loading states that have no more
 * specific skeleton. Deliberately vague — a shape that suggests "a page" reads
 * better than a detailed skeleton of the wrong page.
 */
export function ContentSkeleton({ cards = 6 }: { cards?: number }) {
  return (
    <>
      <div className="nr-skeleton h-8 w-56" />
      <div className="nr-skeleton mt-3 h-4 w-80 max-w-full" />
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: cards }).map((_, i) => (
          <div key={i} className="flex flex-col gap-3">
            <div className="nr-skeleton h-40 w-full rounded-2xl" />
            <div className="nr-skeleton h-4 w-3/4" />
            <div className="nr-skeleton h-4 w-1/2" />
          </div>
        ))}
      </div>
    </>
  );
}

/** Text-shaped stand-in, for prose pages (legal, blog posts). */
export function ProseSkeleton({ lines = 12 }: { lines?: number }) {
  return (
    <>
      <div className="nr-skeleton h-8 w-2/3" />
      <div className="mt-6 flex flex-col gap-3">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="nr-skeleton h-4"
            style={{ width: `${[100, 96, 88, 92][i % 4]}%` }}
          />
        ))}
      </div>
    </>
  );
}
