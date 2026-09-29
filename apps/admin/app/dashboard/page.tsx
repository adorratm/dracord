'use client';

import Link from 'next/link';
import { AdminShell } from '@/components/AdminShell';
import { HealthStatus } from '@/components/HealthStatus';
import { getApiBaseUrl } from '@/lib/client';

const links = [
  { href: '/users', title: 'Kullanıcılar', desc: 'Kayıtlı kullanıcıları ara ve görüntüle.' },
  { href: '/guilds', title: 'Sunucular', desc: 'Hesabınıza bağlı sunucu listesi.' },
  {
    href: '/queues',
    title: 'Kuyruklar',
    desc: 'Bull Board — arka plan iş kuyruğu izleme.',
  },
];

export default function DashboardPage() {
  const queuesUrl = `${getApiBaseUrl()}/admin/queues`;

  return (
    <AdminShell>
      <div className="space-y-8">
        <section>
          <h2 className="text-xl font-semibold text-dracula-fg">Panel</h2>
          <p className="mt-1 text-sm text-dracula-comment">
            Dracord yönetim özeti ve hızlı bağlantılar.
          </p>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-dracula-comment">
            Sağlık durumu
          </h3>
          <HealthStatus />
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {links.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg border border-dracula-current bg-dracula-bg p-5 transition hover:border-dracula-purple"
            >
              <h3 className="font-semibold text-dracula-purple">{item.title}</h3>
              <p className="mt-2 text-sm text-dracula-comment">{item.desc}</p>
            </Link>
          ))}
        </section>

        <section className="rounded-lg border border-dracula-current bg-dracula-bg-darker p-4 text-sm text-dracula-comment">
          Kuyruk panosu doğrudan API üzerinde:{' '}
          <a
            href={queuesUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-dracula-cyan underline"
          >
            {queuesUrl}
          </a>
        </section>
      </div>
    </AdminShell>
  );
}
