import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Dovanorius",
  description: "Wishlist website for friends and family",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <footer>
          <div className="footer footer-center p-4 bg-base-300 text-base-content rounded">
            <div>
              <p>Copyright © 2025 - All right reserved by Dovanorius</p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
