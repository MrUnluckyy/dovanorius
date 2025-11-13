import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "NoriuTo - Sectret Santa",
  description:
    "Svajok kartu su NoriuTo, kurk norų lentas ir dalinkis jomis su draugais bei šeima 🎁",
};

export default async function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div data-theme="christmas" className="min-h-screen">
      {children}
    </div>
  );
}
