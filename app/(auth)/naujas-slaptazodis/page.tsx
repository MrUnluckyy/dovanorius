import SetNewPassword from "../components/SetNewPassword";
import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Deliberately unguarded.
 *
 * This page used to redirect anyone holding a session away to /boards, which
 * bounced the exact person it exists for: clicking a recovery link establishes
 * a recovery session, so by the time this rendered they *had* one. It also shut
 * out every anonymous guest, the same bug /login already fixed.
 *
 * Arriving here with an ordinary session is fine — updateUser({ password })
 * acts on that session and nothing else. The deliberate "change my password"
 * flow in /account asks for the current password; this one treats the emailed
 * link as the proof, which is what recovery means.
 */
export default async function ResetPassword() {
  return (
    <main>
      <div className="hero min-h-screen">
        <div className="hero-content flex-col lg:flex-row-reverse">
          <div className="card bg-base-100 w-full max-w-sm shrink-0 shadow-2xl">
            <div className="card-body">
              <SetNewPassword />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
