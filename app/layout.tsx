import type { Metadata } from "next";
import { Providers } from "@/components/providers/Providers";
import { Baloo_2, Inter, Over_the_Rainbow } from "next/font/google";
import "./globals.css";
import { NextIntlClientProvider } from "next-intl";
import { cookies } from "next/headers";
import { Toaster } from "react-hot-toast";
import { Analytics } from "@vercel/analytics/next";
import Clarity from "@microsoft/clarity";

const headings = Baloo_2({
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
const body = Inter({
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
    title: "Noriuto - Tavo norų sąrašai vienoje vietoje!",
    description:
      "Svajok kartu su Noriuto.lt - kurk norų / dovanų sąrašus ir dalinkis jais su draugais bei šeima. 🎁",
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

  if (process.env.NODE_ENV === "production") {
    Clarity.init("ujhfbpkjx8");
  }

  return (
    <html lang={locale} data-theme="noriuto" suppressHydrationWarning>
      <body
        className={`${headings.variable} ${body.variable} ${special.variable} antialiased relative`}
      >
        <NextIntlClientProvider>
          <Toaster />
          <Providers>
            {children}
            <Analytics mode="production" />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
