'use client';

import { useEffect, useState } from 'react';

/**
 * Platform uygulamaları özeti — tam CRUD kullanıcı Ayarlar → Gelişmiş’te.
 * Admin burada flag durumunu ve doküman linklerini gösterir.
 */
export default function DevelopersAdminPage() {
  const [health, setHealth] = useState<{
    platformApi?: boolean;
    platformOauth?: boolean;
  } | null>(null);

  useEffect(() => {
    const api =
      process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ||
      'http://localhost:4000';
    void fetch(`${api}/v1/health`)
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth({ platformApi: false }));
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-6 py-10 text-dracula-fg">
      <h1 className="text-2xl font-semibold text-dracula-purple">Geliştiriciler</h1>
      <p className="mt-2 text-sm text-dracula-comment">
        Public Platform API / bot token / OAuth — flag ile açılır.
      </p>
      <div className="mt-6 rounded border border-dracula-current bg-dracula-bg p-4 text-sm">
        <p>
          PLATFORM_API:{' '}
          <strong className="text-dracula-green">
            {health?.platformApi ? 'açık' : 'kapalı'}
          </strong>
        </p>
        <p className="mt-1">
          PLATFORM_OAUTH:{' '}
          <strong>{health?.platformOauth ? 'açık' : 'kapalı'}</strong>
        </p>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-dracula-comment">
          <li>
            Kullanıcı uygulamaları: web Ayarlar → Gelişmiş (developerMode)
          </li>
          <li>
            Spec: <code>docs/platform-api-tasarim.md</code>
          </li>
          <li>
            Bot: <code>Authorization: Bot &lt;token&gt;</code> →{' '}
            <code>POST /v1/channels/:id/messages</code>
          </li>
          <li>
            OAuth: <code>GET /oauth2/authorize</code> +{' '}
            <code>POST /oauth2/token</code>
          </li>
        </ul>
      </div>
    </div>
  );
}
