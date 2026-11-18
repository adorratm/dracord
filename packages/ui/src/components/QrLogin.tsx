'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { toQR } from 'toqr';
import type { AuthTokens, PublicUser } from '@dracord/types';

/** E4 — the page the QR points to; the phone camera opens it, it hands over to the app */
export const QR_LOGIN_WEB_BASE = 'https://dracord.com.tr';
export const qrLoginUrl = (ticketId: string, base = QR_LOGIN_WEB_BASE): string => `${base}/qr/${ticketId}`;

interface QrLoginClient {
  createQrLogin(platform?: string): Promise<{ ticketId: string; pollToken: string; expiresAt: string }>;
  pollQrLogin(
    ticketId: string,
    pollToken: string,
  ): Promise<
    | { status: 'pending' | 'rejected' | 'expired' }
    | { status: 'scanned'; user: { displayName: string; avatarUrl: string | null } }
    | ({ status: 'approved'; user: PublicUser } & AuthTokens)
  >;
}

/** A crisp SVG QR code (one path, quiet zone included) */
export function QrCodeSvg({ value, size = 184, className }: { value: string; size?: number; className?: string }) {
  const { n, d } = useMemo(() => {
    const bits = toQR(value);
    const n = Math.round(Math.sqrt(bits.length));
    let d = '';
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) if (bits[y * n + x]) d += `M${x + 4} ${y + 4}h1v1h-1z`;
    }
    return { n, d };
  }, [value]);
  const box = n + 8;
  return (
    <svg
      viewBox={`0 0 ${box} ${box}`}
      width={size}
      height={size}
      role="img"
      aria-label="Giriş için QR kodu"
      shapeRendering="crispEdges"
      className={className}
    >
      <rect width={box} height={box} fill="#fff" />
      <path d={d} fill="#000" />
    </svg>
  );
}

type Phase =
  | { kind: 'loading' }
  | { kind: 'ready'; ticketId: string; pollToken: string; expiresAt: number }
  | { kind: 'scanned'; ticketId: string; pollToken: string; expiresAt: number; name: string; avatarUrl: string | null }
  | { kind: 'error'; message: string };

const POLL_MS = 1500;

/**
 * E4 — "Telefonla giriş": shows a QR; scanning it with the Dracord app (signed in) and
 * approving signs this computer in. The ticket renews itself when it expires.
 */
export function QrLoginPanel({
  client,
  platform,
  onLoggedIn,
  webBase = QR_LOGIN_WEB_BASE,
}: {
  client: QrLoginClient;
  platform: 'web' | 'desktop';
  onLoggedIn: (result: AuthTokens & { user: PublicUser }) => void;
  webBase?: string;
}) {
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [note, setNote] = useState<string | null>(null);
  const done = useRef(false);
  const cb = useRef(onLoggedIn);
  cb.current = onLoggedIn;

  const newTicket = useRef(async () => {
    try {
      const t = await client.createQrLogin(platform);
      setPhase({ kind: 'ready', ticketId: t.ticketId, pollToken: t.pollToken, expiresAt: Date.parse(t.expiresAt) });
    } catch (err) {
      setPhase({ kind: 'error', message: err instanceof Error ? err.message : 'QR kodu oluşturulamadı' });
    }
  });

  useEffect(() => {
    void newTicket.current();
  }, []);

  const ticketId = phase.kind === 'ready' || phase.kind === 'scanned' ? phase.ticketId : null;
  const pollToken = phase.kind === 'ready' || phase.kind === 'scanned' ? phase.pollToken : null;

  useEffect(() => {
    if (!ticketId || !pollToken) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = async () => {
      if (stop || done.current) return;
      try {
        const r = await client.pollQrLogin(ticketId, pollToken);
        if (stop) return;
        if (r.status === 'approved') {
          done.current = true;
          const { status: _s, ...rest } = r;
          void _s;
          cb.current(rest);
          return;
        }
        if (r.status === 'expired') {
          setNote(null);
          void newTicket.current();
          return;
        }
        if (r.status === 'rejected') {
          setNote('Telefondan reddedildi. Yeni bir kod oluşturuldu.');
          void newTicket.current();
          return;
        }
        if (r.status === 'scanned') {
          setPhase((p) =>
            p.kind === 'ready' || p.kind === 'scanned'
              ? { kind: 'scanned', ticketId: p.ticketId, pollToken: p.pollToken, expiresAt: p.expiresAt, name: r.user.displayName, avatarUrl: r.user.avatarUrl }
              : p,
          );
        }
      } catch {
        /* network blip: keep polling */
      }
      timer = setTimeout(() => void tick(), POLL_MS);
    };
    timer = setTimeout(() => void tick(), POLL_MS);
    return () => {
      stop = true;
      if (timer) clearTimeout(timer);
    };
  }, [client, ticketId, pollToken]);

  return (
    <div className="w-full rounded-xl bg-surface-container-low border border-outline-variant p-space-md flex items-center gap-space-md">
      <div className="shrink-0 rounded-lg overflow-hidden bg-white p-1" style={{ width: 152, height: 152 }}>
        {phase.kind === 'ready' || phase.kind === 'scanned' ? (
          <div className={phase.kind === 'scanned' ? 'opacity-20 blur-[1px] transition' : 'transition'}>
            <QrCodeSvg value={qrLoginUrl(phase.ticketId, webBase)} size={144} />
          </div>
        ) : (
          <div className="w-full h-full grid place-items-center text-black/50 text-xs">
            {phase.kind === 'error' ? 'QR yok' : 'Hazırlanıyor…'}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-headline-md text-on-surface">Telefonla giriş</p>
        {phase.kind === 'scanned' ? (
          <p className="font-body-sm text-on-surface-variant" aria-live="polite">
            <strong className="text-on-surface">{phase.name || 'Hesabın'}</strong> okuttu — telefonda
            girişi onayla.
          </p>
        ) : phase.kind === 'error' ? (
          <>
            <p className="font-body-sm text-error">{phase.message}</p>
            <button type="button" className="font-label-sm text-primary underline" onClick={() => void newTicket.current()}>
              Tekrar dene
            </button>
          </>
        ) : (
          <p className="font-body-sm text-on-surface-variant">
            Telefonunda Dracord açıkken (giriş yapmış) kamerayla bu kodu okut ve onayla. Şifre ya da Google
            gerekmez.
          </p>
        )}
        {note ? <p className="font-body-sm text-dracula-orange">{note}</p> : null}
      </div>
    </div>
  );
}

interface QrApproveClient {
  scanQrLogin(ticketId: string): Promise<{ device: string | null; platform: string | null; ip: string | null; createdAt: string }>;
  decideQrLogin(ticketId: string, approve: boolean): Promise<{ ok: true }>;
}

/** E4 — on the signed-in phone browser: "Bu bilgisayarda giriş yapılsın mı?" */
export function QrApproveCard({ client, ticketId, userName }: { client: QrApproveClient; ticketId: string; userName: string }) {
  const [info, setInfo] = useState<{ device: string | null; ip: string | null } | null>(null);
  const [state, setState] = useState<'loading' | 'ask' | 'busy' | 'approved' | 'rejected' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let off = false;
    client
      .scanQrLogin(ticketId)
      .then((r) => {
        if (off) return;
        setInfo({ device: r.device, ip: r.ip });
        setState('ask');
      })
      .catch((err) => {
        if (off) return;
        setError(err instanceof Error ? err.message : 'QR kodu açılamadı');
        setState('error');
      });
    return () => {
      off = true;
    };
  }, [client, ticketId]);
  const decide = (approve: boolean) => {
    setState('busy');
    client
      .decideQrLogin(ticketId, approve)
      .then(() => setState(approve ? 'approved' : 'rejected'))
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'İşlem başarısız');
        setState('error');
      });
  };
  return (
    <div className="w-full max-w-sm rounded-2xl bg-surface-container-low p-space-lg space-y-space-md text-center">
      <span className="material-symbols-outlined text-[44px] text-primary">qr_code_scanner</span>
      {state === 'loading' ? <p className="text-on-surface-variant">Kontrol ediliyor…</p> : null}
      {state === 'error' ? <p className="text-error">{error}</p> : null}
      {state === 'approved' ? <p className="text-on-surface">Giriş onaylandı. Bilgisayarındaki Dracord açılıyor.</p> : null}
      {state === 'rejected' ? <p className="text-on-surface">Giriş reddedildi.</p> : null}
      {state === 'ask' || state === 'busy' ? (
        <>
          <h1 className="font-headline-lg text-on-surface">Bu cihazda giriş yapılsın mı?</h1>
          <p className="text-on-surface-variant font-body-md">
            <strong className="text-on-surface">{info?.device ?? 'Bilinmeyen cihaz'}</strong>
            {info?.ip ? ` · ${info.ip}` : ''} cihazı <strong className="text-on-surface">{userName}</strong> hesabıyla
            giriş yapmak istiyor. Bu kodu sen açmadıysan reddet.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={state === 'busy'}
              onClick={() => decide(false)}
              className="flex-1 h-11 rounded-lg bg-surface-container-high text-on-surface font-label-md disabled:opacity-50"
            >
              Reddet
            </button>
            <button
              type="button"
              disabled={state === 'busy'}
              onClick={() => decide(true)}
              className="flex-1 h-11 rounded-lg bg-primary-container text-on-primary-container font-label-md disabled:opacity-50"
            >
              Girişi onayla
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
