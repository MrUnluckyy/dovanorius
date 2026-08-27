import { createClient } from "@/utils/supabase/server";
import { LoginForm } from "../components/LoginForm";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Noriuto.lt - prisijunk",
  description:
    "Prisijunkite prie Noriuto.lt ir pradėkite kurti savo norų sąrašus bei dalintis jais su draugais ir šeima.",
  robots: { index: false, follow: false },
};

export default async function Login() {
  const t = await getTranslations("Auth");
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  // A guest who has reserved something carries an anonymous session, which is
  // not "logged in" in any sense they'd recognise. Bouncing them to /dashboard
  // meant that once you had reserved a gift you could never reach this page.
  if (user && !user.is_anonymous) {
    redirect("/dashboard");
  }

  return (
    <main>
      <div className="hero-content flex-col lg:flex-row-reverse">
        <div className="text-center lg:text-left w-full px-4 md:min-w-md">
          <h1 className="text-5xl font-bold font-heading">
            {t("loginHeading")}
          </h1>
          <p className="py-6 max-w-prose font-heading">
            {t("loginDescription")}
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
