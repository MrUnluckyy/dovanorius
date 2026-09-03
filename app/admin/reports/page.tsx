import { supabaseAdmin } from "@/utils/supabase/admin";
import { ReportsList, type ReportRow } from "./_components/ReportsList";

export const dynamic = "force-dynamic";

/**
 * Triage for everything the app reported about itself, and everything people
 * wrote to us. AdminLayout has already checked profiles.is_admin, and the
 * table is service-role only, so the read happens here rather than in the
 * client.
 */
export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string }>;
}) {
  const { show } = await searchParams;
  const showAll = show === "all";

  let query = supabaseAdmin
    .from("client_reports")
    .select(
      "id, created_at, kind, area, reason, detail, path, user_agent, is_guest, message, contact_email, handled_at"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (!showAll) query = query.is("handled_at", null);

  const { data, error } = await query;

  if (error) {
    return (
      <p className="text-error">Nepavyko įkelti pranešimų: {error.message}</p>
    );
  }

  return (
    <ReportsList
      rows={(data ?? []) as ReportRow[]}
      showAll={showAll}
      // People writing in are the scarce signal; surface how many are waiting.
      pendingMessages={
        (data ?? []).filter((r) => r.kind === "report" && !r.handled_at).length
      }
    />
  );
}
