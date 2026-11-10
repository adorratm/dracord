'use client';

import { useEffect, useState } from 'react';
import { FAQ_LIMITS, faqBestMatch, type GuildFaqConfigDto, type GuildFaqEntry } from '@dracord/types';
import { cn } from '../lib/cn';

export type GuildFaqClient = {
  getGuildFaq(guildId: string): Promise<GuildFaqConfigDto>;
  updateGuildFaq(guildId: string, patch: Partial<Omit<GuildFaqConfigDto, 'guildId'>>): Promise<GuildFaqConfigDto>;
};

const field =
  'w-full rounded-lg border border-outline-variant/60 bg-surface-container-low px-3 py-2 font-body-md text-on-surface outline-none focus:border-primary';

/** D4 — sunucu SSS (Draco `/sss`) + isteğe bağlı otomatik yanıt */
export function GuildFaqSettings({
  client,
  guildId,
  channels,
}: {
  client: GuildFaqClient;
  guildId: string;
  channels: Array<{ id: string; name: string }>;
}) {
  const [cfg, setCfg] = useState<GuildFaqConfigDto | null>(null);
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [test, setTest] = useState('');

  useEffect(() => {
    void client.getGuildFaq(guildId).then((c) => {
      setCfg(c);
      setSaved(JSON.stringify(c));
    });
  }, [client, guildId]);

  if (!cfg) return <p className="font-body-sm text-outline">Yükleniyor…</p>;
  const dirty = JSON.stringify(cfg) !== saved;
  const setEntry = (id: string, p: Partial<GuildFaqEntry>) => setCfg({ ...cfg, entries: cfg.entries.map((e) => (e.id === id ? { ...e, ...p } : e)) });
  const hit = test.trim() ? faqBestMatch(test, cfg.entries) : null;

  return (
    <div className="space-y-space-md">
      <p className="font-body-sm text-on-surface-variant">
        Üyeler <code>/sss &lt;soru&gt;</code> yazınca Draco en uygun cevabı verir. Sorudaki kelimeler ve anahtar kelimeler eşleşir (yapay zekâ yok).
      </p>
      <ul className="space-y-3">
        {cfg.entries.map((e, i) => (
          <li key={e.id} className="space-y-2 rounded-xl bg-surface-container-low p-space-sm">
            <div className="flex items-center gap-2">
              <span className="font-label-sm text-outline">{i + 1}.</span>
              <input className={field} value={e.question} maxLength={FAQ_LIMITS.questionMax} onChange={(x) => setEntry(e.id, { question: x.target.value })} placeholder="Soru (ör. Rol nasıl alınır?)" />
              <button
                type="button"
                onClick={() => setCfg({ ...cfg, entries: cfg.entries.filter((x) => x.id !== e.id) })}
                className="rounded p-1 text-outline hover:text-error"
                aria-label="Soruyu sil"
              >
                <span className="material-symbols-outlined text-[18px]">delete</span>
              </button>
            </div>
            <input
              className={field}
              value={e.keywords.join(', ')}
              onChange={(x) => setEntry(e.id, { keywords: x.target.value.split(',').map((k) => k.trim()).filter(Boolean).slice(0, FAQ_LIMITS.keywords) })}
              placeholder="Anahtar kelimeler, virgülle (ör. rol, rütbe, yetki)"
            />
            <textarea className={field} rows={3} value={e.answer} maxLength={FAQ_LIMITS.answerMax} onChange={(x) => setEntry(e.id, { answer: x.target.value })} placeholder="Cevap" />
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled={cfg.entries.length >= FAQ_LIMITS.entries}
        onClick={() => setCfg({ ...cfg, entries: [...cfg.entries, { id: `n${Date.now().toString(36)}`, question: '', keywords: [], answer: '' }] })}
        className="rounded-lg bg-surface-container-high px-3 py-1.5 font-label-md text-on-surface disabled:opacity-50"
      >
        + Soru ekle
      </button>

      <label className="flex cursor-pointer items-start gap-3">
        <input type="checkbox" className="mt-1 h-4 w-4" checked={cfg.autoAnswer} onChange={(x) => setCfg({ ...cfg, autoAnswer: x.target.checked })} />
        <span>
          <span className="block font-label-md text-on-surface">Otomatik yanıt</span>
          <span className="block font-body-sm text-on-surface-variant">
            &ldquo;?&rdquo; ile biten bir mesaj bir soruyla güçlü eşleşirse Draco kendiliğinden cevaplar (kanal başına dakikada en fazla bir kez).
          </span>
        </span>
      </label>
      {cfg.autoAnswer ? (
        <div className="space-y-1">
          <p className="font-label-sm text-on-surface-variant">Yalnız bu kanallarda (hiçbiri seçilmezse tümünde):</p>
          <div className="flex flex-wrap gap-1.5">
            {channels.map((c) => {
              const on = cfg.autoChannelIds.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() =>
                    setCfg({ ...cfg, autoChannelIds: on ? cfg.autoChannelIds.filter((x) => x !== c.id) : [...cfg.autoChannelIds, c.id].slice(0, FAQ_LIMITS.autoChannels) })
                  }
                  className={cn('rounded-full px-2.5 py-1 font-label-sm', on ? 'bg-primary-container text-on-primary-container' : 'bg-surface-container-high text-on-surface')}
                >
                  #{c.name}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="space-y-1">
        <input className={field} value={test} onChange={(x) => setTest(x.target.value)} placeholder="Dene: bir soru yaz" />
        {test.trim() ? (
          <p className="font-body-sm text-on-surface-variant">
            {hit && hit.score >= 0.4
              ? `→ ${hit.entry.question} (benzerlik %${Math.round(hit.score * 100)}${hit.score >= 0.75 ? ', otomatik yanıt verir' : ''})`
              : 'Eşleşme yok — Draco genel bilgisine bakar.'}
          </p>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!dirty || busy}
          onClick={() => {
            setBusy(true);
            setMsg(null);
            const { guildId: _g, ...patch } = cfg;
            void client
              .updateGuildFaq(guildId, { ...patch, entries: patch.entries.filter((e) => e.question.trim() && e.answer.trim()) })
              .then((c) => {
                setCfg(c);
                setSaved(JSON.stringify(c));
                setMsg({ ok: true, text: 'Kaydedildi.' });
              })
              .catch((e) => setMsg({ ok: false, text: e instanceof Error ? e.message : 'Kaydedilemedi' }))
              .finally(() => setBusy(false));
          }}
          className="rounded-lg bg-primary px-4 py-2 font-label-md text-on-primary disabled:opacity-50"
        >
          {busy ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
        {msg ? <span className={cn('font-body-sm', msg.ok ? 'text-on-surface-variant' : 'text-error')}>{msg.text}</span> : null}
      </div>
    </div>
  );
}
