import { createClient } from "@/utils/supabase/server";
import type { Metadata } from "next";
import Link from "next/link";
import { JoinBoardClient } from "./JoinBoardClient";

export const metadata: Metadata = {
  title: "Noriuto - kvietimas",
  robots: { index: false, follow: false },
};

export default async function JoinBoardPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();

  const { data: rows } = await supabase.rpc("get_board_invite", {
    p_token: token,
  });
  const invite = Array.isArray(rows) ? rows[0] : null;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // A real (non-anonymous) signed-in user already has an identity.
  const isRealUser = !!user && user.is_anonymous !== true;

  if (!invite) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="card card-border bg-base-100 max-w-sm w-full">
          <div className="card-body text-center gap-4">
            <h1 className="text-xl font-bold font-heading text-error">
              Kvietimas nebegalioja arba jau buvo panaudotas.
            </h1>
            <p className="text-sm text-base-content/60">
              Paprašyk asmens, kuris tave pakvietė, naujo kvietimo.
            </p>
            <Link href="/" className="btn btn-primary btn-sm">
              Į pagrindinį
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <JoinBoardClient
      token={token}
      boardName={invite.board_name}
      isRealUser={isRealUser}
    />
  );
}
