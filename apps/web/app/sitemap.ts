import type { MetadataRoute } from 'next';

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'https://dracord.com.tr';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const paths = [
    '',
    '/login',
    '/legal/privacy',
    '/legal/terms',
    '/legal/kvkk',
    '/legal/cookies',
    '/legal/community',
  ];
  return paths.map((path) => ({
    url: `${siteUrl}${path || '/'}`,
    lastModified: now,
    changeFrequency: path === '' ? 'weekly' : 'monthly',
    priority: path === '' ? 1 : path.startsWith('/legal') ? 0.4 : 0.7,
  }));
}
