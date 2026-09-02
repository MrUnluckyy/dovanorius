/**
 * Stands in for a single board while its three Supabase round-trips finish:
 * the board bar, then the wish grid. Mirrors WishList's column counts so the
 * cards don't jump when the real ones arrive.
 */
export function BoardDetailSkeleton() {
  return (
    <>
      <div className="nr-skeleton h-4 w-40" />
      <div className="py-8 mb-10 flex flex-wrap items-center gap-4">
        <div className="nr-skeleton h-16 w-16 rounded-full" />
        <div className="flex flex-col gap-2">
          <div className="nr-skeleton h-7 w-48" />
          <div className="nr-skeleton h-4 w-32" />
        </div>
        <div className="nr-skeleton ml-auto h-10 w-28" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-3">
            <div className="nr-skeleton h-36 w-full rounded-2xl" />
            <div className="nr-skeleton h-4 w-3/4" />
            <div className="nr-skeleton h-8 w-full" />
          </div>
        ))}
      </div>
    </>
  );
}
