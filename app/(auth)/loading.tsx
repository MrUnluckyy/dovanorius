/**
 * The auth group's layout is a centred hero with no navbar, so the global
 * shell (which draws a stand-in navbar) would be wrong here.
 */
export default function Loading() {
  return (
    <div className="hero-content flex-col lg:flex-row-reverse w-full">
      <div className="w-full px-4 md:min-w-md">
        <div className="nr-skeleton h-12 w-3/4" />
        <div className="nr-skeleton mt-4 h-4 w-full" />
        <div className="nr-skeleton mt-2 h-4 w-2/3" />
      </div>
      <div className="card bg-base-100 w-full max-w-sm shrink-0 shadow-2xl">
        <div className="card-body gap-4">
          <div className="nr-skeleton h-7 w-32" />
          <div className="nr-skeleton h-12 w-full" />
          <div className="nr-skeleton h-4 w-16 self-center" />
          <div className="nr-skeleton h-12 w-full" />
          <div className="nr-skeleton h-12 w-full" />
          <div className="nr-skeleton mt-2 h-12 w-full" />
        </div>
      </div>
    </div>
  );
}
