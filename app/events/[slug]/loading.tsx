import { PageLoadingShell } from "@/components/loaders/PageLoadingShell";
import { EventLobbySkeleton } from "@/components/loaders/EventLobbySkeleton";

/**
 * Without this, /events/[slug] fell back to app/events/loading.tsx and showed
 * the events *list* skeleton — three fake rows — before rendering a lobby.
 */
export default function Loading() {
  return (
    <PageLoadingShell>
      <EventLobbySkeleton />
    </PageLoadingShell>
  );
}
