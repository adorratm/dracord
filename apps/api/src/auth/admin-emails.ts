import type { ConfigService } from '@nestjs/config';

/** Varsayılan platform admin — ADMIN_EMAILS ile override edilir (virgülle ayrılmış). */
export const DEFAULT_ADMIN_EMAIL = 'emrekilic19983@gmail.com';

export function parseAdminEmails(config: ConfigService): string[] {
  const raw = config.get<string>('ADMIN_EMAILS')?.trim();
  const source = raw && raw.length > 0 ? raw : DEFAULT_ADMIN_EMAIL;
  return [
    ...new Set(
      source
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}

export function isAdminEmail(config: ConfigService, email: string | null | undefined): boolean {
  if (!email) return false;
  return parseAdminEmails(config).includes(email.trim().toLowerCase());
}

export function isAdminOAuthIntent(state: unknown): boolean {
  return String(state ?? '').toLowerCase() === 'admin';
}

export function isDesktopOAuthIntent(state: unknown): boolean {
  return String(state ?? '').toLowerCase() === 'desktop';
}
