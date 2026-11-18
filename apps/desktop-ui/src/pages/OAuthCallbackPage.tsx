import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { AuthTokens, PublicUser } from '@dracord/types';
import { isNetworkFailure, withNetworkRetry } from '@dracord/sdk';
import { useAuth } from '../auth';
import { colors } from '@dracord/app-theme';

/**
 * End of a Google sign-in: the dracord:// link brought the session here. The tokens are kept
 * at once (so even if this screen fails, the next start is signed in); the profile request
 * is retried while the network is shaky, and a failure offers "try again" instead of a dead
 * "Failed to fetch".
 */
export function OAuthCallbackPage() {
  const [params] = useSearchParams();
  const { setSession, client, persistTokens } = useAuth();
  const nav = useNavigate();
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState('Oturum açılıyor…');
  const [attempt, setAttempt] = useState(0);
  const tokens = useRef<AuthTokens | null>(null);

  const run = useCallback(async () => {
    setErr(null);
    setNote('Oturum açılıyor…');
    try {
      if (!tokens.current) {
        const payload = params.get('payload');
        const electron = params.get('electron');
        if (!payload || !electron) throw new Error('Geçersiz giriş bağlantısı. Giriş ekranından tekrar dene.');
        const raw = decodeURIComponent(payload);
        const q = raw.includes('?') ? raw.split('?')[1]! : raw.replace(/^oauth\?/, '');
        const sp = new URLSearchParams(q);
        if (sp.get('error')) throw new Error(`Google girişi tamamlanamadı (${sp.get('reason') ?? sp.get('error')}). Tekrar dene.`);
        const accessToken = sp.get('accessToken');
        const refreshToken = sp.get('refreshToken');
        if (!accessToken || !refreshToken) throw new Error('Giriş bilgisi gelmedi. Giriş ekranından tekrar dene.');
        tokens.current = { accessToken, refreshToken } as AuthTokens;
        persistTokens(tokens.current);
      }
      client.setToken(tokens.current.accessToken);
      const user = await withNetworkRetry(() => client.getMe(), {
        tries: 5,
        onRetry: () => setNote('Sunucuya ulaşılamadı, yeniden deneniyor…'),
      });
      setSession(tokens.current, user as PublicUser);
      nav('/', { replace: true });
    } catch (e) {
      setErr(
        isNetworkFailure(e)
          ? 'Giriş yapıldı ama Dracord sunucusuna ulaşılamadı. İnternet bağlantını kontrol edip “Tekrar dene”ye bas; uygulamayı kapatıp açsan da oturumun açık gelecek.'
          : e instanceof Error
            ? e.message
            : 'Giriş tamamlanamadı.',
      );
    }
  }, [params, client, setSession, persistTokens, nav]);

  useEffect(() => {
    void run();
  }, [run, attempt]);

  const btn = {
    height: 40,
    padding: '0 18px',
    borderRadius: 10,
    border: 'none',
    fontWeight: 700,
    cursor: 'pointer',
  } as const;

  return (
    <div style={{ minHeight: '100%', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div style={{ maxWidth: 420, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {err ? (
          <>
            <p style={{ margin: 0, color: colors.text, lineHeight: 1.5 }}>{err}</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              {tokens.current ? (
                <button type="button" style={{ ...btn, background: colors.primary, color: '#11131e' }} onClick={() => setAttempt((n) => n + 1)}>
                  Tekrar dene
                </button>
              ) : null}
              <button type="button" style={{ ...btn, background: colors.surfaceHigh, color: colors.text }} onClick={() => nav('/login', { replace: true })}>
                Giriş ekranı
              </button>
            </div>
          </>
        ) : (
          <p style={{ margin: 0, color: colors.textMuted }}>{note}</p>
        )}
      </div>
    </div>
  );
}
