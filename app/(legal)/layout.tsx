import type { ReactNode } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import Footer from "@/components/footer/Footer";
import { NavigationV2 } from "@/components/navigation/NavigationV2";

export default async function LegalLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return (
    <>
      <NavigationV2 user={user} />
      <main className="min-h-screen bg-base-100 text-base-content">
        <div className="mx-auto flex max-w-4xl flex-col px-4 py-10 lg:py-16">
          <header className="mb-8 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">
                noriuto.lt
              </p>
              <p className="text-sm text-base-content/70">
                Teisinė informacija ir dokumentai
              </p>
            </div>
            <Link href="/" className="btn btn-ghost btn-sm rounded-full">
              Į pradžią
            </Link>
          </header>

          <section className="card border border-base-300/60 bg-base-100 shadow-xl">
            <div className="card-body prose prose-sm max-w-none sm:prose-base">
              {children}
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
