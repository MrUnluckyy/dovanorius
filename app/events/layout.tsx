import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "NoriuTo - Renginiai",
  description:
    "Svajok kartu su NoriuTo, kurk norų lentas ir dalinkis jomis su draugais bei šeima 🎁",
};

export default async function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // No hardcoded theme here — the events area hosts multiple event types. The
  // Christmas theme is applied per-event in the lobby only for Secret Santa.
  return <div className="min-h-screen overflow-x-hidden">{children}</div>;
}
