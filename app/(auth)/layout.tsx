import type { ReactNode } from "react";

export default async function AuthLayout({
  children,
}: {
  children: ReactNode;
}) {
  // A <div>, not <main>: each page in this group renders its own <main>, and
  // nesting them is invalid. The gradient lands on the brand yellow rather than
  // the stray #FFE035 it used to end on.
  return (
    <div className="hero min-h-screen bg-gradient-to-b from-secondary/20 via-base-100 to-(--nr-yellow) text-base-content">
      {children}
    </div>
  );
}
