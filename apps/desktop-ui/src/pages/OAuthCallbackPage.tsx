import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { AuthTokens, PublicUser } from '@dracord/types';
import { useAuth } from '../auth';

export function OAuthCallbackPage() {
  const [params] = useSearchParams();
  const { setSession, client } = useAuth();
  const nav = useNavigate();
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const payload = params.get('payload');
    const electron = params.get('electron');
    void (async () => {
      try {
        if (payload && electron) {
          const raw = decodeURIComponent(payload);
          const q = raw.includes('?') ? raw.split('?')[1]! : raw.replace(/^oauth\?/, '');
          const sp = new URLSearchParams(q);
          const accessToken = sp.get('accessToken');
          const refreshToken = sp.get('refreshToken');
          if (!accessToken || !refreshToken) throw new Error('Token yok');
          client.setToken(accessToken);
          const user = await client.getMe();
          setSession({ accessToken, refreshToken } as AuthTokens, user as PublicUser);
          nav('/', { replace: true });
          return;
        }
        throw new Error('Geçersiz callback');
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'OAuth hatası');
      }
    })();
  }, [params, client, setSession, nav]);

  if (err) return <div style={{ padding: 24 }}>{err}</div>;
  return <div style={{ padding: 24 }}>Oturum açılıyor…</div>;
}
