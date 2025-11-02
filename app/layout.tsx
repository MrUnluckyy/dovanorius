import type { Metadata } from "next";
import { Providers } from "@/components/providers/Providers";
import { Geist, Geist_Mono, Poppins, Rubik, Baloo_2 } from "next/font/google";
import "./globals.css";
import { NextIntlClientProvider } from "next-intl";
import { cookies } from "next/headers";

const rubik = Rubik({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

const ballo = Baloo_2({ subsets: ["latin"], weight: ["400", "600", "700"] });

export const metadata: Metadata = {
  title: "Dovanorius",
  description: "Wishlist website for friends and family",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const store = await cookies();
  const locale = store.get("locale")?.value || "lt";

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={`${ballo.className} antialiased`}>
        <NextIntlClientProvider>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
