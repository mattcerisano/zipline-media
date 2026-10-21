import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";
import { productionBranchError } from "./src/lib/production-branch";

/**
 * STUDIO_ONLY=1 turns the deployment into just the app: the marketing site at
 * `/` and its pages redirect to the Command Center. Decided at build time, so
 * a deployment that never sets it carries no redirect rule at all.
 */
const STUDIO_ONLY = process.env.STUDIO_ONLY === '1';

const nextConfig: NextConfig = {
  // One value for both sides of the owner bypass: the server checks
  // OWNER_EMAIL (src/lib/api-owner.ts), the login screen checks the public
  // copy (src/lib/studio.ts). Setting the one variable configures both.
  env: {
    NEXT_PUBLIC_OWNER_EMAIL: process.env.OWNER_EMAIL || '',
  },
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
  async redirects() {
    if (!STUDIO_ONLY) return [];
    const toApp = (source: string) => ({ source, destination: '/command-center', permanent: false });
    return [
      toApp('/'),
      toApp('/archive'),
      toApp('/archive/:path*'),
      toApp('/services'),
      toApp('/services/:path*'),
      toApp('/gear'),
      toApp('/gear/:path*'),
      toApp('/photography'),
      toApp('/photography/:path*'),
    ];
  },
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
