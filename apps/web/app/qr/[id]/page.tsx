'use client';

import { QrApproveCard } from '@dracord/ui';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Draco } from '@/components/Draco';
import { useAuth } from '@/components/AuthProvider';

/** E4 — the phone camera opens this; signed in here → approve, otherwise hand over to the app */
export default function QrLoginPage() {
  const params = useParams<{ id: string }>();
  const id = String(params?.id ?? '');
  const { ready, user, client } = useAuth();
  const valid = /^[a-f0-9]{32}$/.test(id);
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-space-lg bg-surface-container-lowest px-space-lg py-space-xl">
      <Draco size={96} mood="wave" glow />
      {!valid ? (
        <p className="text-error">Geçersiz QR kodu.</p>
      ) : !ready ? (
        <p className="text-on-surface-variant">Yükleniyor…</p>
      ) : user ? (
        <QrApproveCard client={client} ticketId={id} userName={user.displayName || user.username} />
      ) : (
        <div className="w-full max-w-sm rounded-2xl bg-surface-container-low p-space-lg space-y-space-md text-center">
          <h1 className="font-headline-lg text-on-surface">Dracord uygulamasında onayla</h1>
          <p className="text-on-surface-variant font-body-md">
            Bilgisayardaki girişi onaylamak için bu kodu Dracord uygulamasında aç. Uygulama yoksa bu tarayıcıda
            giriş yapıp tekrar okut.
          </p>
          <a
            href={`dracord://qr/${id}`}
            className="block w-full h-11 leading-[2.75rem] rounded-lg bg-primary-container text-on-primary-container font-label-md"
          >
            Uygulamada aç
          </a>
          <Link
            href={`/login?returnUrl=${encodeURIComponent(`/qr/${id}`)}`}
            className="block w-full h-11 leading-[2.75rem] rounded-lg bg-surface-container-high text-on-surface font-label-md"
          >
            Bu tarayıcıda giriş yap
          </Link>
        </div>
      )}
    </div>
  );
}
