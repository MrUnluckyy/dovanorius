import { createClient } from "@/utils/supabase/server";
import { LoginForm } from "../components/LoginForm";
import { redirect } from "next/navigation";
import { Metadata } from "next";

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
    redirect("/dashboard");
  }

  return (
    <main>
      <div className="hero-content flex-col lg:flex-row-reverse">
        <div className="text-center lg:text-left w-full px-4 md:min-w-md">
          <h1 className="text-5xl font-bold font-heading">Prisijunk</h1>
          <p className="py-6 max-w-prose font-heading">
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
    </main>
  );
}
