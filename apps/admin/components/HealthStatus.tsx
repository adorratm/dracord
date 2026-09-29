'use client';

import { useEffect, useState } from 'react';
import { getAccessToken } from '@/lib/storage';
import { getApiBaseUrl } from '@/lib/client';

type CheckState = 'loading' | 'ok' | 'warn' | 'error';

interface Row {
  label: string;
  state: CheckState;
  detail: string;
}

function badge(state: CheckState): string {
  switch (state) {
    case 'ok':
      return 'bg-dracula-green/20 text-dracula-green';
    case 'warn':
      return 'bg-dracula-orange/20 text-dracula-orange';
    case 'error':
      return 'bg-dracula-red/20 text-dracula-red';
    default:
      return 'bg-dracula-current text-dracula-comment';
  }
}

function label(state: CheckState): string {
  switch (state) {
    case 'ok':
      return 'Çalışıyor';
    case 'warn':
      return 'Kısıtlı';
    case 'error':
      return 'Erişilemiyor';
    default:
      return 'Kontrol ediliyor…';
  }
}

export function HealthStatus() {
  const [rows, setRows] = useState<Row[]>([
    { label: 'API', state: 'loading', detail: '' },
    { label: 'LiveKit (yapılandırma)', state: 'loading', detail: '' },
  ]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const apiUrl = getApiBaseUrl();
      const livekitPublic =
        process.env.NEXT_PUBLIC_LIVEKIT_URL?.trim() || 'ws://localhost:7880';
      const token = getAccessToken();
      let apiState: CheckState = 'error';
      let apiDetail = 'Bağlantı kurulamadı';

      try {
        const res = await fetch(`${apiUrl}/users/search?q=`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          apiState = 'ok';
          apiDetail = `${apiUrl} — kimlik doğrulama başarılı`;
        } else if (res.status === 401) {
          apiState = 'warn';
          apiDetail = `${apiUrl} — ayakta (401, oturum gerekli)`;
        } else {
          apiState = 'warn';
          apiDetail = `${apiUrl} — HTTP ${res.status}`;
        }
      } catch {
        apiState = 'error';
        apiDetail = `${apiUrl} — sunucuya ulaşılamıyor`;
      }

      const lkState: CheckState = livekitPublic ? 'ok' : 'warn';
      const lkDetail = livekitPublic
        ? `NEXT_PUBLIC_LIVEKIT_URL=${livekitPublic}`
        : 'LiveKit URL tanımlı değil';

      if (!cancelled) {
        setRows([
          { label: 'API', state: apiState, detail: apiDetail },
          { label: 'LiveKit (yapılandırma)', state: lkState, detail: lkDetail },
        ]);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ul className="divide-y divide-dracula-current rounded-lg border border-dracula-current bg-dracula-bg">
      {rows.map((row) => (
        <li key={row.label} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium text-dracula-fg">{row.label}</p>
            <p className="text-sm text-dracula-comment">{row.detail}</p>
          </div>
          <span className={`inline-flex w-fit rounded px-2 py-0.5 text-xs font-semibold ${badge(row.state)}`}>
            {label(row.state)}
          </span>
        </li>
      ))}
    </ul>
  );
}
