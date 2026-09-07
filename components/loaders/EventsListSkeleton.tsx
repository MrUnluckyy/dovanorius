/**
 * The shape /events settles into.
 *
 * Shared by the route's `loading.tsx` (which covers the server auth check) and
 * by SsHomeScreen's own query state, so the two waits look like one continuous
 * skeleton instead of two different ones flashing in sequence.
 */
export function EventsListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="grid gap-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="nr-skeleton h-[92px] w-full rounded-[24px]"
        />
      ))}
    </div>
  );
}
