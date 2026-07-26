import type { Metadata } from "next";

import { Analytics } from "@vercel/analytics/react";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import FeedbackHost from "@/components/Feedback";
import OfflineIndicator from "@/components/OfflineIndicator";



export const metadata: Metadata = {
  title: {
    default: "Zipline Media | Creative Video Production",
    template: "%s | Zipline Media",
  },
  description: "Zipline is a video production agency of writers, actors, and filmmakers in NYC specializing in Broadway, Corporate, and Creative Storytelling.",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://www.zipline.media",
    siteName: "Zipline Media",
    title: "Zipline Media | Creative Video Production",
    description: "Zipline is a video production agency of writers, actors, and filmmakers in NYC that creates exceptional video content at any budget.",
    images: [
      {
        url: "/Zipline Logo FULL Blue.png", // Fallback to local logo until we have a dedicated OG image
        width: 1200,
        height: 630,
        alt: "Zipline Media Logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Zipline Media | Creative Video Production",
    description: "Zipline is a video production agency of writers, actors, and filmmakers in NYC that creates exceptional video content at any budget.",
    images: ["/Zipline Logo FULL Blue.png"],
  },
  metadataBase: new URL("https://www.zipline.media"),
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
    <html lang="en">
      <body className="antialiased bg-background text-foreground">
        <Navbar />
        <main>{children}</main>
        <Footer />
        <ServiceWorkerRegister />
        <FeedbackHost />
        <OfflineIndicator />
        <Analytics />
      </body>
    </html>
  );
}