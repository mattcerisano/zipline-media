/**
 * The site's canonical origin, used for metadataBase, Open Graph URLs, the
 * sitemap, robots.txt and the links inside calendar feeds.
 *
 * Set SITE_URL on a deployment that lives somewhere else (another studio's
 * domain, or its *.vercel.app address). For the original deployment it stays
 * the apex: www.zipline.media 308-redirects there (set in Vercel → Domains).
 * Build-time, like everything in next.config.ts — redeploy after changing it.
 */
export const SITE_URL = (process.env.SITE_URL || '').trim().replace(/\/+$/, '') || 'https://zipline.media';
