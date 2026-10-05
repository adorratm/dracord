import type { ConfigService } from '@nestjs/config';

/**
 * Platform admin allowlist — yalnızca ADMIN_EMAILS env.
 * Kodda kişisel e-posta hardcode etme (public repo hedef listesi olmasın).
 */
export function parseAdminEmails(config: ConfigService): string[] {
  const raw = config.get<string>('ADMIN_EMAILS')?.trim();
  if (!raw) return [];
  return [
    ...new Set(
      raw
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
