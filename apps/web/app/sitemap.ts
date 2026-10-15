import type { MetadataRoute } from 'next';

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'https://dracord.com.tr';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const paths = [
    '',
    '/download',
    '/login',
    '/legal/privacy',
    '/legal/terms',
    '/legal/kvkk',
    '/legal/cookies',
    '/legal/community',
    '/llms.txt',
  ];
  return paths.map((path) => ({
    url: `${siteUrl}${path || '/'}`,
    lastModified: now,
    changeFrequency: path === '' || path === '/download' ? 'weekly' : 'monthly',
    priority:
      path === ''
        ? 1
        : path === '/download'
          ? 0.9
          : path.startsWith('/legal')
            ? 0.4
            : path === '/llms.txt'
              ? 0.3
              : 0.7,
  }));
}
