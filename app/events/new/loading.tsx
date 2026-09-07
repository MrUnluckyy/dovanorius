import { PageLoadingShell } from "@/components/loaders/PageLoadingShell";

/** The create wizard opens on the type picker: a heading and two cards. */
export default function Loading() {
  return (
    <PageLoadingShell>
      <div className="mx-auto w-full max-w-[440px]">
        <div className="nr-skeleton mb-2 h-8 w-40" />
        <div className="nr-skeleton mb-7 h-4 w-64" />
        <div className="grid gap-3">
          <div className="nr-skeleton h-[104px] w-full rounded-[24px]" />
          <div className="nr-skeleton h-[104px] w-full rounded-[24px]" />
        </div>
      </div>
    </PageLoadingShell>
  );
}
