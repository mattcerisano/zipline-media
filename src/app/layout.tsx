import type { Metadata } from "next";

import { Analytics } from "@vercel/analytics/react";
import "./globals.css";
import { SITE_URL } from "@/lib/site";
import { IS_DEFAULT_STUDIO, STUDIO_NAME, STUDIO_OS_NAME } from "@/lib/studio";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import FeedbackHost from "@/components/Feedback";



// The marketing copy below is the original studio's. Another studio's
// deployment (NEXT_PUBLIC_STUDIO_NAME set) is just the app, so it gets the
// app's own name and a plain description instead.
const title = IS_DEFAULT_STUDIO ? "Zipline Media | Creative Video Production" : STUDIO_OS_NAME;
const description = IS_DEFAULT_STUDIO
  ? "Zipline is a video production agency of writers, actors, and filmmakers in NYC specializing in Broadway, Corporate, and Creative Storytelling."
  : `Production command center for ${STUDIO_NAME}: crews, gear, schedules, and clients.`;
const socialDescription = IS_DEFAULT_STUDIO
  ? "Zipline is a video production agency of writers, actors, and filmmakers in NYC that creates exceptional video content at any budget."
  : description;
const socialImages = IS_DEFAULT_STUDIO
  ? [{ url: "/Zipline Logo FULL Blue.png", width: 1200, height: 630, alt: "Zipline Media Logo" }]
  : [];

export const metadata: Metadata = {
  title: {
    default: title,
    template: `%s | ${STUDIO_NAME}`,
  },
  description,
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: STUDIO_NAME,
    title,
    description: socialDescription,
    images: socialImages,
  },
  twitter: {
    card: "summary_large_image",
    title,
    description: socialDescription,
    images: socialImages.map((i) => i.url),
  },
  metadataBase: new URL(SITE_URL),
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Studio OS",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // The cached brand colour is applied to <html> before React hydrates (see
    // src/lib/brand-theme.ts), so its style attribute legitimately differs
    // from the server's. This only silences that element's own attributes.
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased bg-background text-foreground">
        <Navbar />
        <main>{children}</main>
        <Footer />
        <ServiceWorkerRegister />
        <FeedbackHost />
        <Analytics />
      </body>
    </html>
  );
}