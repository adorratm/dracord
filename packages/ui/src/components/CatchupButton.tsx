'use client';

import { useEffect, useState } from 'react';
import type { CatchupDto, CatchupMessageRef } from '@dracord/types';
import { cn } from '../lib/cn';
import { summarizeOnDevice, summarizerSupported } from '../lib/summarize';
import { Avatar } from './Avatar';
import { Modal } from './Modal';

export type CatchupClient = {
  getChannelCatchup(
    channelId: string,
    opts?: { since?: string; afterMessageId?: string | null; lastN?: number; until?: string },
  ): Promise<CatchupDto>;
};

/** Bu kadar okunmamış varsa düğme vurgulanır */
const HIGHLIGHT_AT = 15;

/**
 * Kanal başlığı için "Ne kaçırdım?" düğmesi + özet penceresi.
 * afterMessageId: kanal AÇILDIĞI andaki son okunan mesaj (okundu işaretlenmeden önce yakalanmalı).
 */
export function CatchupButton({
  client,
  channelId,
  afterMessageId,
  unreadCount = 0,
  openedAt,
  onJump,
  className,
}: {
  client: CatchupClient;
  channelId: string;
  afterMessageId?: string | null;
  unreadCount?: number;
  /** Kanalın açıldığı an (ISO) — unreadCount ile birlikte çapa */
  openedAt?: string;
  onJump?: (messageId: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<CatchupDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [aiOk, setAiOk] = useState(false);
  const [ai, setAi] = useState<{ state: 'idle' | 'loading' | 'done' | 'error'; text?: string; progress?: number }>({
    state: 'idle',
  });

  useEffect(() => {
    void summarizerSupported().then(setAiOk);
  }, []);
  useEffect(() => {
    setData(null);
    setAi({ state: 'idle' });
  }, [channelId, afterMessageId]);

  const load = async () => {
    setOpen(true);
    if (data) return;
    setLoading(true);
    setErr(null);
    try {
      setData(
        await client.getChannelCatchup(channelId, {
          afterMessageId,
          lastN: !afterMessageId && unreadCount > 0 ? unreadCount : undefined,
          until: openedAt,
        }),
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Özet alınamadı');
    } finally {
      setLoading(false);
    }
  };

  const runAi = async () => {
    if (!data?.transcript.length) return;
    setAi({ state: 'loading' });
    try {
      const text = await summarizeOnDevice(data.transcript.join('\n'), {
        onProgress: (p) => setAi({ state: 'loading', progress: p }),
      });
      setAi({ state: 'done', text });
    } catch {
      setAi({ state: 'error' });
    }
  };

  const Section = ({ title, icon, items }: { title: string; icon: string; items: CatchupMessageRef[] }) =>
    items.length ? (
      <section className="flex flex-col gap-1">
        <h4 className="font-label-md text-on-surface flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[18px] text-primary-container" aria-hidden>
            {icon}
          </span>
          {title}
        </h4>
        {items.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => {
              onJump?.(m.id);
              setOpen(false);
            }}
            className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-surface-container"
          >
            <Avatar displayName={m.authorName} imageUrl={m.avatarUrl} size="sm" className="mt-0.5" />
            <span className="min-w-0 flex-1">
              <span className="font-label-sm text-on-surface">{m.authorName}</span>
              {m.reactionCount ? (
                <span className="ml-1 font-label-sm text-outline">· {m.reactionCount} tepki</span>
              ) : null}
              <span className="block font-body-sm text-on-surface-variant line-clamp-2">{m.contentPreview || '—'}</span>
            </span>
          </button>
        ))}
      </section>
    ) : null;

  const hot = unreadCount >= HIGHLIGHT_AT;

  return (
    <>
      <button
        type="button"
        onClick={() => void load()}
        className={cn(
          'h-8 rounded-lg flex items-center justify-center gap-1 transition-colors',
          hot
            ? 'px-2 bg-primary-container/15 text-primary-container hover:bg-primary-container/25'
            : 'w-8 text-outline hover:bg-surface-container hover:text-on-surface',
          className,
        )}
        aria-label="Ne kaçırdım?"
        title="Ne kaçırdım?"
      >
        <span className="material-symbols-outlined text-[18px]">summarize</span>
        {hot && <span className="font-label-sm hidden sm:inline">Ne kaçırdım?</span>}
      </button>
      <Modal open={open} title="Ne kaçırdım?" onClose={() => setOpen(false)} className="sm:max-w-lg">
        <div className="max-h-[65vh] overflow-y-auto flex flex-col gap-space-md pr-1">
          {loading && <p className="font-body-sm text-outline">Özet hazırlanıyor…</p>}
          {err && <p className="font-body-sm text-error">{err}</p>}
          {data && (
            <>
              <p className="font-body-sm text-on-surface-variant">
                {data.totalNew === 0
                  ? 'Kaçırdığın bir şey yok 🎉'
                  : `${new Date(data.since).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })} sonrasında ${data.totalNew} mesaj.`}
              </p>
              {data.participants.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {data.participants.map((p) => (
                    <span key={p.userId} className="inline-flex items-center gap-1 rounded-full bg-surface-container px-2 py-0.5">
                      <Avatar displayName={p.name} imageUrl={p.avatarUrl} size="sm" />
                      <span className="font-label-sm text-on-surface">{p.name}</span>
                      <span className="font-label-sm text-outline">{p.count}</span>
                    </span>
                  ))}
                </div>
              )}
              {aiOk && data.transcript.length > 5 && (
                <div className="rounded-xl border border-surface-container-highest bg-surface-container-low p-3">
                  {ai.state === 'idle' && (
                    <button
                      type="button"
                      onClick={() => void runAi()}
                      className="h-8 px-3 rounded-lg bg-primary-container text-on-primary-container font-label-sm"
                    >
                      Yapay zekâ ile özetle (cihazında)
                    </button>
                  )}
                  {ai.state === 'loading' && (
                    <p className="font-body-sm text-outline">
                      Özetleniyor…
                      {ai.progress !== undefined && ai.progress < 1 ? ` (model %${Math.round(ai.progress * 100)})` : ''}
                    </p>
                  )}
                  {ai.state === 'done' && (
                    <p className="font-body-sm text-on-surface whitespace-pre-wrap">{ai.text}</p>
                  )}
                  {ai.state === 'error' && <p className="font-body-sm text-outline">Bu cihazda yapay zekâ özeti yapılamadı.</p>}
                  <p className="mt-1 font-label-sm text-outline">Mesajlar cihazından çıkmaz.</p>
                </div>
              )}
              <Section title="Senden bahsedenler" icon="alternate_email" items={data.mentions} />
              <Section title="Öne çıkanlar" icon="local_fire_department" items={data.topReacted} />
              <Section title="Sabitlenenler" icon="push_pin" items={data.pinned} />
              <Section title="Anketler" icon="ballot" items={data.polls} />
              {data.links.length > 0 && (
                <section className="flex flex-col gap-1">
                  <h4 className="font-label-md text-on-surface flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[18px] text-primary-container" aria-hidden>
                      link
                    </span>
                    Paylaşılan bağlantılar
                  </h4>
                  {data.links.map((l) => (
                    <a
                      key={l.url}
                      href={l.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-body-sm text-primary-container truncate hover:underline px-2"
                    >
                      {l.url} <span className="text-outline">· {l.authorName}</span>
                    </a>
                  ))}
                </section>
              )}
            </>
          )}
        </div>
      </Modal>
    </>
  );
}
