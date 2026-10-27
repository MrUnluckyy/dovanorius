/**
 * The join screen deliberately renders no navigation — it is the first thing
 * an invited stranger sees, and a nav bar full of links they cannot use is
 * noise. So this cannot use PageLoadingShell, whose whole job is to stand in
 * for a navbar: it would flash a header that never arrives.
 */
export default function Loading() {
  return (
    <main
      aria-busy="true"
      aria-live="polite"
      className="min-h-screen bg-(--nr-cream) px-4 py-10 md:py-16"
    >
      <span className="sr-only">Kraunama…</span>
      <div className="mx-auto w-full max-w-[440px] space-y-4">
        <div className="nr-skeleton h-[250px] w-full rounded-[24px]" />
        <div className="nr-skeleton h-[190px] w-full rounded-[24px]" />
      </div>
    </main>
  );
}
