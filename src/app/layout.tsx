import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["700", "900"],
  variable: "--font-montserrat",
});

export const metadata: Metadata = {
  title: "Zipline Media | Creative Video Production",
  description: "Boutique video production company specializing in Broadway, Corporate, and Creative Storytelling.",
  icons: {
    icon: "/Zipline Logo 10x10_Black Text Blue.png",
  }
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
      </body>
    </html>
  );
}