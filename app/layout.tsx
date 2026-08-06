import type { Metadata } from "next";
import { Providers } from "@/components/providers/Providers";
import {
  Bricolage_Grotesque,
  Instrument_Sans,
  Over_the_Rainbow,
} from "next/font/google";
import "./globals.css";
import { NextIntlClientProvider } from "next-intl";
import { cookies } from "next/headers";
import { Toaster } from "react-hot-toast";
import { Analytics } from "@vercel/analytics/next";
import { GoogleTagManager } from "@next/third-parties/google";
import { GtmPageView } from "@/components/GtmPageView";
import { PostHogProvider } from "@/components/providers/PostHogProvider";
import { createClient } from "@/utils/supabase/server";

/* Display face — headlines, buttons, numbers (Noriuto design system) */
const headings = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
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
/* Body / UI face */
const body = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_WEB_URL ?? "https://noriuto.lt",
  ),
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
    "msapplication-TileColor": "#FFD166",
    "impact-site-verification": "0955783e-a1ff-4edb-84e7-4a433f800da6",
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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Site-wide structured data so search engines resolve the name, logo and key
  // sections (rather than inventing a "Logo" entry from the header image).
  const siteUrl = process.env.NEXT_PUBLIC_WEB_URL ?? "https://www.noriuto.lt";
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        name: "Noriuto",
        url: siteUrl,
        logo: `${siteUrl}/favicons/android-chrome-512x512.png`,
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        name: "Noriuto.lt",
        url: siteUrl,
        inLanguage: locale,
        publisher: { "@id": `${siteUrl}/#organization` },
      },
    ],
  };

  return (
    <html lang={locale} data-theme="noriuto" suppressHydrationWarning>
      <body
        className={`${headings.variable} ${body.variable} ${special.variable} antialiased relative`}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <NextIntlClientProvider>
          <GoogleTagManager gtmId={process.env.NEXT_PUBLIC_GTM_ID!} />
          <GtmPageView />
          <Toaster />
          <Providers>
            <PostHogProvider userId={user?.id} userEmail={user?.email} />
            <div className="bg-(--nr-cream) text-(--nr-ink) font-body min-h-screen">
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
