import type { ReactNode } from "react";

export default async function AuthLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <main className="hero min-h-screen bg-gradient-to-b from-secondary/20 via-base-100 to-[#FFE035] text-base-content ">
      {children}
    </main>
  );
}
