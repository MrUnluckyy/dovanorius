import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function JoinPartnerPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirect=/partner/join/${token}`);
  }

  const { data: result } = await supabase.rpc("accept_partner_invite", {
    p_token: token,
  });

  const res = result as { ok?: boolean; error?: string; partner_id?: string };

  if (res?.ok) {
    redirect("/partner");
  }

  const errorMessages: Record<string, string> = {
    not_authenticated: "Turite prisijungti.",
    invalid_or_expired: "Kvietimas nebegalioja arba jau buvo panaudotas.",
  };

  const message = errorMessages[res?.error ?? ""] ?? "Klaida priimant kvietimą.";

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="card card-border bg-base-100 max-w-sm w-full">
        <div className="card-body text-center gap-4">
          <h1 className="text-xl font-bold font-heading text-error">{message}</h1>
          <p className="text-sm text-base-content/60">
            Susisiekite su partneriu, kuris jus pakvietė, ir paprašykite naujo kvietimo.
          </p>
          <Link href="/dashboard" className="btn btn-primary btn-sm">
            Į pagrindinį
          </Link>
        </div>
      </div>
    </div>
  );
}
