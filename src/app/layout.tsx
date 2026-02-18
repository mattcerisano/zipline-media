import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["700", "900"],
  variable: "--font-montserrat",
});

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
};

export const viewport = {
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${montserrat.variable} antialiased bg-background text-foreground`}>
        <Navbar />
        <main>{children}</main>
        <Footer />
        <Analytics />
      </body>
    </html>
  );
}