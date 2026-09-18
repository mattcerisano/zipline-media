import type { Metadata } from 'next';

import PhotographyClient from './PhotographyClient';

// Unlisted page: nothing on the site links to it, it is kept out of sitemap.ts
// and disallowed in robots.ts, and the noindex/nofollow below tells crawlers
// that do find the URL to drop it. That is obscurity, not access control —
// anyone with the link can open it. Say the word if it should sit behind the
// Command Center login instead.
export const metadata: Metadata = {
  title: 'Photography',
  description: 'Photography — film and digital.',
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
};

export default function PhotographyPage() {
  return <PhotographyClient />;
}
