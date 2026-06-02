"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import toast from "react-hot-toast";

type AcceptResult = {
  ok?: boolean;
  error?: string;
  board_id?: string;
  board_slug?: string;
};

export function JoinBoardClient({
  token,
  boardName,
  isRealUser,
}: {
  token: string;
  boardName: string;
  isRealUser: boolean;
}) {
  const supabase = createClient();
  const router = useRouter();
  const turnstileRef = useRef<TurnstileInstance>(null);
  const [name, setName] = useState("");
  const [joining, setJoining] = useState(false);

  const join = async () => {
    setJoining(true);
    try {
      // Guests join without an account via a silent anonymous session.
      if (!isRealUser) {
        let captchaToken: string | undefined;
        try {
          captchaToken = await turnstileRef.current?.getResponsePromise();
        } catch {
          /* no captcha configured / failed — proceed without */
        }
        const { error: authError } = await supabase.auth.signInAnonymously({
          options: { captchaToken },
        });
        if (authError) {
          turnstileRef.current?.reset();
          throw authError;
        }
      }

      const { data, error } = await supabase.rpc("accept_board_invite", {
        p_token: token,
        p_display_name: name,
      });
      if (error) throw error;

      const res = data as AcceptResult;
      if (res?.ok && res.board_id) {
        router.push(`/boards/${res.board_id}`);
        return;
      }
      toast.error(
        res?.error === "invalid_or_expired"
          ? "Kvietimas nebegalioja."
          : "Nepavyko prisijungti prie lentos."
      );
      setJoining(false);
    } catch (err) {
      console.error("Join board failed:", err);
      toast.error("Nepavyko prisijungti prie lentos.");
      setJoining(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-20">
      <div className="card card-border bg-base-100 max-w-sm w-full shadow-sm">
        <div className="card-body gap-4">
          <h1 className="text-xl font-bold font-heading">
            Tave pakvietė prisidėti prie lentos{" "}
            <span className="text-primary">{boardName}</span>
          </h1>
          <p className="text-sm text-base-content/60">
            Paskyros kurti nereikia - prisijunk kaip svečias ir pridėk savo
            idėjų.
          </p>

          {!isRealUser && (
            <label className="form-control w-full">
              <span className="label-text mb-1">Tavo vardas</span>
              <input
                type="text"
                className="input input-bordered w-full"
                placeholder="pvz. Justas"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
          )}

          {!isRealUser && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
            <Turnstile
              ref={turnstileRef}
              siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
              options={{ size: "invisible" }}
            />
          )}

          <button
            className="btn btn-primary w-full"
            onClick={join}
            disabled={joining || (!isRealUser && !name.trim())}
          >
            {joining ? (
              <span className="loading loading-dots loading-md" />
            ) : (
              "Prisijungti prie lentos"
            )}
          </button>

          {!isRealUser && (
            <p className="text-center text-sm text-base-content/60">
              Turi paskyrą?{" "}
              <Link
                href={`/login?next=/boards/join/${token}`}
                className="link link-hover text-primary"
              >
                Prisijunk
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
