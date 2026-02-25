import type { Metadata } from "next";
import { Providers } from "@/components/providers/Providers";
import {
  Baloo_2,
  Funnel_Display,
  Inter,
  Over_the_Rainbow,
  Rubik,
} from "next/font/google";
import "./globals.css";
import { NextIntlClientProvider } from "next-intl";
import { cookies } from "next/headers";
import { Toaster } from "react-hot-toast";
import { Analytics } from "@vercel/analytics/next";
import { GoogleTagManager } from "@next/third-parties/google";
import { GtmPageView } from "@/components/GtmPageView";

const headings = Funnel_Display({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-heading",
  display: "swap",
});
const special = Over_the_Rainbow({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-special",
  display: "swap",
  adjustFontFallback: false,
});
const body = Baloo_2({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Noriuto.lt - Tavo norų sąrašai vienoje vietoje!",
  description:
    "Svajok kartu su Noriuto.lt - kurk norų / dovanų sąrašus ir dalinkis jais su draugais bei šeima. 🎁",
  manifest: "/favicons/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicons/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicons/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicons/favicon.ico" },
    ],
    apple: "/favicons/apple-touch-icon.png",
  },
  other: {
    "msapplication-TileColor": "#31473A",
  },
  openGraph: {
    title: "Noriuto - Tavo norų sąrašai vienoje vietoje!",
    description:
      "Svajok kartu su Noriuto.lt - kurk norų / dovanų sąrašus ir dalinkis jais su draugais bei šeima. 🎁",
    url: "https://www.noriuto.lt",
    siteName: "Noriuto",
    images: [
      {
        url: "/assets/meta/noriuto-meta.jpg",
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
    title: "Noriuto - Tavo norų sąrašai vienoje vietoje!",
    description:
      "Svajok kartu su Noriuto.lt - kurk norų / dovanų sąrašus ir dalinkis jais su draugais bei šeima. 🎁",
    images: ["/assets/meta/noriuto-meta.jpg"],
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
    <html lang={locale} data-theme="noriuto" suppressHydrationWarning>
      <body
        className={`${headings.variable} ${body.variable} ${special.variable} antialiased relative`}
      >
        <NextIntlClientProvider>
          <GoogleTagManager gtmId={process.env.NEXT_PUBLIC_GTM_ID!} />
          <GtmPageView />
          <Toaster />
          <Providers>
            <div className="bg-gradient-to-b from-secondary/20 via-base-100 to-[#FFE035]">
              {children}
            </div>
            <Analytics mode="production" />
            {/* <ClarityProvider /> */}
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
