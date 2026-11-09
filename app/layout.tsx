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
import { ClaimedReservationsNotice } from "@/components/reservations/ClaimedReservationsNotice";
import { ReportProblemDialog } from "@/components/feedback/ReportProblemDialog";
import { ContactChat } from "@/components/feedback/ContactChat";
import { Analytics } from "@vercel/analytics/next";
import { GoogleTagManager } from "@next/third-parties/google";
import { GtmPageView } from "@/components/GtmPageView";
import { PostHogProvider } from "@/components/providers/PostHogProvider";
import { ConsentBanner } from "@/components/consent/ConsentBanner";
import { CONSENT_COOKIE, consentDefaultsScript, parseConsent } from "@/lib/consent";
import { createClient } from "@/utils/supabase/server";
import { SITE_URL } from "@/lib/siteUrl";

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
  // Every relative canonical in the app resolves against this. It used to fall
  // back to the apex, which 307s to www — so posts declared a canonical URL
  // that redirects. SITE_URL always names the host we actually serve from.
  metadataBase: new URL(SITE_URL),
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
    url: SITE_URL,
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
  // Read here so a returning visitor's choice applies before any tag loads.
  const consent = parseConsent(store.get(CONSENT_COOKIE)?.value);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Site-wide structured data so search engines resolve the name, logo and key
  // sections (rather than inventing a "Logo" entry from the header image).
  const siteUrl = SITE_URL;
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
        {/* Consent Mode v2 defaults (denied) must be in the dataLayer before GTM. */}
        <script dangerouslySetInnerHTML={{ __html: consentDefaultsScript(consent) }} />
        <NextIntlClientProvider>
          <GoogleTagManager gtmId={process.env.NEXT_PUBLIC_GTM_ID!} />
          <GtmPageView />
          <Toaster />
          <ClaimedReservationsNotice />
          <ReportProblemDialog />
          <ContactChat />
          <Providers>
            <PostHogProvider
              userId={user?.id}
              userEmail={user?.email}
              analyticsAllowed={!!consent?.analytics}
            />
            <div className="bg-(--nr-cream) text-(--nr-ink) font-body min-h-screen">
              {children}
            </div>
            <Analytics mode="production" />
            {/* <ClarityProvider /> — if it comes back, render it only with consent?.analytics. */}
            <ConsentBanner initial={consent} />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
