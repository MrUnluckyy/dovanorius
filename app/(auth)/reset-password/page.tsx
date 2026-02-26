import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import SetNewPassword from "../components/SetNewPassword";

export default async function ForgotPassword() {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (user) {
    redirect("boards");
  }

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
