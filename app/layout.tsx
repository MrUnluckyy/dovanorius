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
  title: "Dovanoriu",
  description:
    "Svajok kartu su Dovanoriu, kurk norų lentas ir dalinkis jomis su draugais bei šeima 🎁",
  manifest: "/favicons/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicons/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicons/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicons/favicon.ico" },
    ],
    apple: "/favicons/apple-touch-icon.png",
  },
  themeColor: "#31473A",
  other: {
    "msapplication-TileColor": "#31473A",
  },
  openGraph: {
    title: "Dovanoriu",
    description:
      "Svajok kartu su Dovanoriu, kurk norų lentas ir dalinkis jomis su draugais bei šeima 🎁",
    url: "https://dovanoriu.lt",
    siteName: "Dovanoriu",
    images: [
      {
        url: "/assets/dovanorius.png",
        width: 1200,
        height: 630,
        alt: "Dovanorius illustration",
      },
    ],
    locale: "lt",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Dovanoriu",
    description:
      "Svajok kartu su Dovanoriu, kurk norų lentas ir dalinkis jomis su draugais bei šeima 🎁",
    images: ["/assets/dovanorius.png"],
  },
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
