import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

// Public marketing pages only. The Command Center, the Gear Builder, share
// links, the unlisted /photography page and API routes stay out — see robots.ts.
export default function sitemap(): MetadataRoute.Sitemap {
  const pages: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] }[] = [
    { path: '/', priority: 1, changeFrequency: 'monthly' },
    { path: '/archive', priority: 0.9, changeFrequency: 'weekly' },
    { path: '/services', priority: 0.7, changeFrequency: 'yearly' },
    { path: '/gear', priority: 0.6, changeFrequency: 'monthly' },
    { path: '/gear/inventory', priority: 0.5, changeFrequency: 'monthly' },
  ];

  return pages.map(({ path, priority, changeFrequency }) => ({
    url: `${SITE_URL}${path === '/' ? '' : path}`,
    changeFrequency,
    priority,
  }));
}
