import { createClient } from "@/utils/supabase/server";
import { LoginForm } from "../components/LoginForm";
import { redirect } from "next/navigation";
import { useTranslations } from "next-intl";
import { ForgotPasswordForm } from "../components/ForgotPasswordForm";

export default async function ForgotPassword() {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (user) {
    redirect("/" + user.id + "/wishlist");
  }

  return (
    <main>
      <div className="hero bg-base-200 min-h-screen">
        <div className="hero-content flex-col lg:flex-row-reverse">
          <div className="text-center lg:text-left">
            <h1 className="text-5xl font-bold">Pamiršai slaptažodį?</h1>
          </div>
          <div className="card bg-base-100 w-full max-w-sm shrink-0 shadow-2xl">
            <div className="card-body">
              <ForgotPasswordForm />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
