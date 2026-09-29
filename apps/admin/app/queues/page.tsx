'use client';

import { AdminShell } from '@/components/AdminShell';
import { getApiBaseUrl } from '@/lib/client';

export default function QueuesPage() {
  const queuesUrl = `${getApiBaseUrl()}/admin/queues`;

  return (
    <AdminShell>
      <div className="flex h-[calc(100vh-8rem)] flex-col space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-dracula-fg">Kuyruklar</h2>
            <p className="text-sm text-dracula-comment">
              Bull Board — API sunucusunda barındırılır.
            </p>
          </div>
          <a
            href={queuesUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded border border-dracula-purple px-3 py-1.5 text-sm text-dracula-purple hover:bg-dracula-purple/10"
          >
            Yeni sekmede aç
          </a>
        </div>
        <iframe
          title="Dracord kuyruk panosu"
          src={queuesUrl}
          className="min-h-0 flex-1 rounded-lg border border-dracula-current bg-dracula-bg-darker"
        />
      </div>
    </AdminShell>
  );
}
