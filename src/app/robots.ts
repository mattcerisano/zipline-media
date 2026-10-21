import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

// Keeps crawlers out of the signed-in app, internal tools, per-job share links,
// the unlisted photography page and API routes. This is a courtesy to search
// engines, not access control.
export default function robots(): MetadataRoute.Robots {
  // STUDIO_ONLY: the marketing pages redirect into the app, so there is
  // nothing for a crawler here at all.
  if (process.env.STUDIO_ONLY === '1') {
    return { rules: { userAgent: '*', disallow: '/' } };
  }
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/command-center', '/gearbuilder', '/share/', '/photography', '/api/'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
