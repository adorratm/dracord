/** Frontend (web) public URL — build-time NEXT_PUBLIC_* */
export function getWebAppUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_WEB_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    'https://dracord.com.tr';
  return raw.replace(/\/$/, '');
}
