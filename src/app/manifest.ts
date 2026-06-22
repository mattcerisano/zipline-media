import type { MetadataRoute } from 'next';

// PWA manifest — makes the Command Center installable on iOS, Android, and desktop
// from a single codebase. Next.js automatically serves this at /manifest.webmanifest
// and injects the <link rel="manifest"> tag.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Zipline Studio OS',
    short_name: 'Studio OS',
    description: 'Production command center for crews, gear, schedules, and clients.',
    start_url: '/command-center',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#000000',
    theme_color: '#000000',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
