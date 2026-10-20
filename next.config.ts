import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";
import { productionBranchError } from "./src/lib/production-branch";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'i.ytimg.com',
      },
      {
        protocol: 'https',
        hostname: 'img.youtube.com',
      },
      {
        protocol: 'https',
        hostname: 'i.vimeocdn.com',
      }
    ],
  },
  // Baseline security headers on every route. Nothing stopped another site
  // from loading the Command Center in a hidden frame and tricking a signed-in
  // user into clicking through it. frame-ancestors is the only CSP directive
  // set — a full script policy would need nonces for the Vimeo/YouTube embeds
  // and Google sign-in, and is a separate job. X-Frame-Options covers older
  // browsers. HSTS is already sent by Vercel.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: "frame-ancestors 'self'" },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default function config(phase: string): NextConfig {
  if (phase === PHASE_PRODUCTION_BUILD) {
    const error = productionBranchError(process.env);
    if (error) throw new Error(error);
  }
  return nextConfig;
}
