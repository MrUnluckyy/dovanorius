import Link from "next/link";

export function EventCard({ title, url }: { title: string; url: string }) {
  return (
    <div className="card bg-base-300 card-xs shadow-sm">
      <div className="card-body justify-center items-center gap-6">
        <h2 className="card-title">{title}</h2>

        <div className="avatar avatar-placeholder">
          <div className="bg-green-700 text-neutral-content w-16 rounded-full">
            <span className="text-2xl">🎅</span>
          </div>
        </div>

        <div className="justify-end card-actions">
          <Link href={url} className="btn btn-primary">
            Atidaryti
          </Link>
        </div>
      </div>
    </div>
  );
}
