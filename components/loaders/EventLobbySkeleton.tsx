/**
 * The shape a single event settles into: identity header with its row of
 * facts, then the action card, then the roster.
 *
 * Used by both `/events/[slug]/loading.tsx` and LobbyClient's query state —
 * without it the lobby inherited the events *list* skeleton and flashed three
 * fake list rows before showing a completely different layout.
 */
export function EventLobbySkeleton() {
  return (
    <div className="mx-auto w-full max-w-[720px] space-y-4">
      <div className="nr-skeleton h-[260px] w-full rounded-[24px]" />
      <div className="nr-skeleton h-[132px] w-full rounded-[24px]" />
      <div className="nr-skeleton h-[180px] w-full rounded-[24px]" />
    </div>
  );
}
