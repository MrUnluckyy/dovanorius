import { AdminNav } from "./_components/AdminNav";
import { requireAdmin } from "./_lib/requireAdmin";

/** Internal Dovanorius admin area. Gated by profiles.is_admin (not partner
 * membership). Non-admins are bounced to their dashboard.
 *
 * This gate alone does NOT protect the pages — they render in parallel with
 * the layout. Every page.tsx under /admin must call requireAdmin() itself. */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return (
    <div className="min-h-screen bg-base-200">
      <AdminNav />
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
