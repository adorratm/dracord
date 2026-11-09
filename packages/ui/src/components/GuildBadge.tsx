'use client';

import { useEffect, useRef, useState } from 'react';
import type { GuildBadgeDto, UserShowcaseDto } from '@dracord/types';
import { cn } from '../lib/cn';

/** Sunucu rozeti çipi (B4): [ikon] EMOJI TAG */
export function GuildBadgeChip({
  badge,
  level,
  className,
  showName = false,
}: {
  badge: Pick<GuildBadgeDto, 'name' | 'iconUrl' | 'tag' | 'emoji'>;
  level?: number | null;
  className?: string;
  showName?: boolean;
}) {
  return (
    <span
      title={`${badge.name} sunucu rozeti`}
      className={cn(
        'inline-flex max-w-full items-center gap-1 rounded-md border border-outline-variant/50 bg-surface-container-high px-1.5 py-0.5 font-label-sm text-on-surface',
        className,
      )}
    >
      {badge.iconUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={badge.iconUrl} alt="" className="h-3.5 w-3.5 shrink-0 rounded-[4px] object-cover" />
      ) : null}
      {badge.emoji ? <span aria-hidden>{badge.emoji}</span> : null}
      <span className="font-bold tracking-wide">{badge.tag}</span>
      {showName ? <span className="truncate text-on-surface-variant">· {badge.name}</span> : null}
      {level != null && level > 0 ? <span className="text-on-surface-variant tabular-nums">· Sv. {level}</span> : null}
    </span>
  );
}

const memo = new Map<string, { at: number; p: Promise<UserShowcaseDto | null> }>();

/** Profil kartı için vitrin yükleyici (60 sn önbellek) */
export function useUserShowcase(
  userId: string | null | undefined,
  load?: (userId: string) => Promise<UserShowcaseDto>,
): UserShowcaseDto | null {
  const [dto, setDto] = useState<UserShowcaseDto | null>(null);
  // Satır içi fonksiyon her render'da yeni — bağımlılık yapma
  const loadRef = useRef(load);
  loadRef.current = load;
  const hasLoader = Boolean(load);
  useEffect(() => {
    setDto(null);
    const load = loadRef.current;
    if (!userId || !load) return;
    let alive = true;
    let hit = memo.get(userId);
    if (!hit || Date.now() - hit.at > 60_000) {
      hit = { at: Date.now(), p: load(userId).catch(() => null) };
      memo.set(userId, hit);
    }
    void hit.p.then((d) => alive && setDto(d));
    return () => {
      alive = false;
    };
  }, [userId, hasLoader]);
  return dto;
}

export function invalidateUserShowcase(userId: string) {
  memo.delete(userId);
}

export type ShowcaseClient = {
  getShowcaseOptions(): Promise<{ featuredGuildId: string | null; options: GuildBadgeDto[] }>;
  setShowcaseGuild(guildId: string | null): Promise<UserShowcaseDto>;
};

/** Ayarlar › Profil: profilinde gösterilecek sunucu rozetini seç */
export function ShowcasePicker({ client, userId }: { client: ShowcaseClient; userId: string }) {
  const [opts, setOpts] = useState<GuildBadgeDto[] | null>(null);
  const [current, setCurrent] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void client
      .getShowcaseOptions()
      .then((r) => {
        setOpts(r.options);
        setCurrent(r.featuredGuildId);
      })
      .catch(() => setOpts([]));
  }, [client]);

  const pick = async (gid: string | null) => {
    setBusy(gid ?? 'none');
    setErr(null);
    try {
      await client.setShowcaseGuild(gid);
      setCurrent(gid);
      invalidateUserShowcase(userId);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Kaydedilemedi');
    } finally {
      setBusy(null);
    }
  };

  if (opts === null) return <p className="font-body-sm text-outline">Yükleniyor…</p>;
  if (opts.length === 0) {
    return (
      <p className="font-body-sm text-on-surface-variant">
        Üyesi olduğun sunucuların hiçbirinin rozeti yok. Sunucu yöneticileri rozeti Sunucu ayarları › Tanıtım sayfası
        bölümünden açabilir.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <div role="radiogroup" aria-label="Profil rozeti" className="flex flex-wrap gap-2">
        <button
          type="button"
          role="radio"
          aria-checked={current === null}
          disabled={busy !== null}
          onClick={() => void pick(null)}
          className={cn(
            'rounded-lg border px-3 py-1.5 font-label-md',
            current === null ? 'border-primary bg-primary-container/15 text-on-surface' : 'border-outline-variant/50 text-on-surface-variant hover:bg-surface-container-high',
          )}
        >
          Gösterme
        </button>
        {opts.map((b) => (
          <button
            key={b.guildId}
            type="button"
            role="radio"
            aria-checked={current === b.guildId}
            disabled={busy !== null}
            onClick={() => void pick(b.guildId)}
            className={cn(
              'rounded-lg border p-1',
              current === b.guildId ? 'border-primary bg-primary-container/15' : 'border-outline-variant/50 hover:bg-surface-container-high',
            )}
          >
            <GuildBadgeChip badge={b} showName className="border-0 bg-transparent" />
          </button>
        ))}
      </div>
      {err ? <p className="font-body-sm text-error">{err}</p> : null}
    </div>
  );
}
