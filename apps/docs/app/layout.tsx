import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Dracord Developer Docs',
  description: 'Platform API, bot gateway, OAuth, shard ve OpenAPI',
};

const GROUPS: Array<{
  label: string;
  items: Array<{ href: string; label: string }>;
}> = [
  {
    label: 'Başlangıç',
    items: [
      { href: '/', label: 'Overview' },
      { href: '/http-api', label: 'HTTP API' },
      { href: '/bot-gateway', label: 'Bot Gateway' },
    ],
  },
  {
    label: 'Platform',
    items: [
      { href: '/oauth', label: 'OAuth2' },
      { href: '/slash-options', label: 'Slash options' },
      { href: '/bot-sdk', label: 'Bot SDK' },
      { href: '/openapi', label: 'OpenAPI' },
    ],
  },
  {
    label: 'Ops',
    items: [{ href: '/ops', label: 'Ops & shard' }],
  },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <body>
        <div className="shell">
          <aside className="nav">
            <Link href="/" className="brand">
              <span className="brand-name">Dracord</span>
              <span className="brand-sub">Developer Docs</span>
            </Link>
            {GROUPS.map((g) => (
              <div key={g.label} className="nav-group">
                <span className="nav-group-label">{g.label}</span>
                <nav>
                  {g.items.map((item) => (
                    <Link key={item.href} href={item.href} className="nav-link">
                      {item.label}
                    </Link>
                  ))}
                </nav>
              </div>
            ))}
            <p className="muted">
              Kaynak: <code>docs/developer/*</code>
              <br />
              Mintlify: <code>docs/mintlify</code>
            </p>
          </aside>
          <main className="content">{children}</main>
        </div>
      </body>
    </html>
  );
}
