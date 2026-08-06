import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { verifyReservationToken } from "@/lib/reservationToken";
import { ReservationActionForm } from "./ReservationActionForm";

export const metadata: Metadata = {
  title: "Noriuto - rezervacija",
  robots: { index: false, follow: false },
};

export default async function ReservationActionPage({
  params,
}: {
  params: Promise<{ action: string; token: string }>;
}) {
  const { action, token } = await params;

  if (action !== "keep" && action !== "release") notFound();

  const verified = verifyReservationToken(token);

  // Look up the item title for context (best-effort; the action itself
  // re-verifies the token server-side before mutating).
  let itemTitle = "Tavo rezervacija";
  if (verified) {
    const { data } = await supabaseAdmin
      .from("items")
      .select("title")
      .eq("id", verified.itemId)
      .is("archived_at", null)
      .maybeSingle();
    if (data?.title) itemTitle = data.title;
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-20">
      {verified ? (
        <ReservationActionForm token={token} action={action} itemTitle={itemTitle} />
      ) : (
        <div className="card bg-base-200 shadow-sm max-w-md mx-auto">
          <div className="card-body items-center text-center">
            <p>Nuoroda nebegalioja. Patikrink, ar atidarei naujausią laišką.</p>
            <a href="https://noriuto.lt" className="btn btn-primary mt-2">
              Į Noriuto
            </a>
          </div>
        </div>
      )}
    </main>
  );
}
