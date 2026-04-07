import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { PartnerLoginForm } from "./PartnerLoginForm";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Partnerių portalas — Noriuto",
  robots: { index: false, follow: false },
};

export default async function PartnerLoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/partner");
  }

  return (
    <div className="min-h-screen bg-base-200 flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <p className="text-xs uppercase tracking-widest text-base-content/40 mb-1">
            Partnerių portalas
          </p>
          <h1 className="text-3xl font-bold font-heading">Prisijungimas</h1>
        </div>
        <div className="card bg-base-100 card-border shadow-sm">
          <div className="card-body">
            <PartnerLoginForm />
          </div>
        </div>
        <p className="text-center text-xs text-base-content/40">
          Neturite paskyros? Susisiekite su Noriuto komanda.
        </p>
      </div>
    </div>
  );
}
