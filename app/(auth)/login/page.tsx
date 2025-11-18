import { createClient } from "@/utils/supabase/server";
import { LoginForm } from "../components/LoginForm";
import { redirect } from "next/navigation";
import { Metadata } from "next";
import { useTranslations } from "next-intl";

export const metadata: Metadata = {
  title: "Noriuto.lt - prisijunk",
  description:
    "Prisijunkite prie Noriuto.lt ir pradėkite kurti savo norų sąrašus bei dalintis jais su draugais ir šeima.",
};

export default async function Login() {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (user) {
    redirect("boards");
  }

  return (
    <main>
      <div className="hero bg-base-200 min-h-screen">
        <div className="hero-content flex-col lg:flex-row-reverse">
          <div className="text-center lg:text-left w-full px-4 md:min-w-md">
            <h1 className="text-5xl font-bold font-special">Prisijunk</h1>
            <p className="py-6 max-w-prose font-special">
              Prisijunkite prie Noriuto.lt ir pradėkite kurti savo norų lentas
              šiandien!
            </p>
          </div>
          <div className="card bg-base-100 w-full max-w-sm shrink-0 shadow-2xl">
            <div className="card-body">
              <LoginForm />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
