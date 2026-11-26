'use client';

import { useRef, useState } from 'react';
import type { GuildBackupRestoreResult, GuildBackupV1 } from '@dracord/types';

export type GuildBackupClient = {
  exportGuildBackup(guildId: string): Promise<GuildBackupV1>;
  restoreGuildBackup(guildId: string, backup: unknown): Promise<GuildBackupRestoreResult>;
  createGuildFromBackup(backup: unknown, name?: string): Promise<GuildBackupRestoreResult>;
};

export interface GuildBackupPanelProps {
  client: GuildBackupClient;
  guildId: string;
  guildName: string;
  isOwner: boolean;
  /** yeni sunucu kurulunca (açmak için) */
  onCreated?: (guildId: string) => void;
}

const btn = 'rounded-lg px-4 py-2 font-label-md disabled:opacity-50';

/** Dosyayı oku ve ayrıştır (tarayıcı / Electron) */
export async function readBackupFile(file: File): Promise<unknown> {
  if (file.size > 2_000_000) throw new Error('Dosya çok büyük (en fazla 2 MB)');
  return JSON.parse(await file.text());
}

function summary(r: GuildBackupRestoreResult) {
  return `${r.roles} rol, ${r.categories} kategori, ${r.channels} kanal eklendi${r.skipped ? ` · ${r.skipped} öğe zaten vardı / desteklenmiyor` : ''}.`;
}

/**
 * Sunucu yedeği ve şablonu (web + desktop): yapıyı JSON olarak indir, bu sunucuya geri yükle
 * (yalnız ekler) ya da aynı yapıyla yeni sunucu kur. Mesajlar ve üyeler yedeğe girmez.
 */
export function GuildBackupPanel({ client, guildId, guildName, isOwner, onCreated }: GuildBackupPanelProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<'restore' | 'new' | null>(null);

  const run = async (key: string, fn: () => Promise<string>) => {
    setBusy(key);
    setMsg(null);
    try {
      setMsg({ ok: true, text: await fn() });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'İşlem başarısız' });
    } finally {
      setBusy(null);
    }
  };

  const download = () =>
    run('export', async () => {
      const data = await client.exportGuildBackup(guildId);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${guildName.replace(/[^\p{L}\p{N}_-]+/gu, '-').slice(0, 40) || 'sunucu'}-yedek-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      return `Yedek indirildi: ${data.roles.length} rol, ${data.categories.length} kategori, ${data.channels.length} kanal.`;
    });

  const cloneHere = () =>
    run('clone', async () => {
      const data = await client.exportGuildBackup(guildId);
      const r = await client.createGuildFromBackup(data, `${guildName} (kopya)`);
      onCreated?.(r.guildId);
      return `Yeni sunucu kuruldu. ${summary(r)}`;
    });

  const onFile = async (f: File | undefined) => {
    const mode = pending;
    setPending(null);
    if (!f || !mode) return;
    await run(mode, async () => {
      const data = await readBackupFile(f);
      if (mode === 'restore') {
        if (!window.confirm('Yedekteki roller, kategoriler ve kanallar bu sunucuya eklenecek. Mevcut hiçbir şey silinmez. Devam edilsin mi?')) return 'İptal edildi.';
        return summary(await client.restoreGuildBackup(guildId, data));
      }
      const r = await client.createGuildFromBackup(data);
      onCreated?.(r.guildId);
      return `Yeni sunucu kuruldu. ${summary(r)}`;
    });
  };

  const pick = (mode: 'restore' | 'new') => {
    setPending(mode);
    fileRef.current?.click();
  };

  return (
    <div className="space-y-space-md">
      <p className="font-body-sm text-on-surface-variant">
        Yedek; kanalları, kategorileri, rolleri (izinleriyle) ve rol bazlı kanal izinlerini içerir. Mesajlar, üyeler ve kişiye özel izinler <b>girmez</b>. Dosya başka biriyle paylaşılınca şablon olarak da kullanılabilir.
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={`${btn} bg-primary text-on-primary`} disabled={!!busy} onClick={() => void download()}>
          {busy === 'export' ? 'Hazırlanıyor…' : 'Yedeği indir'}
        </button>
        <button type="button" className={`${btn} bg-surface-container-high text-on-surface`} disabled={!!busy} onClick={() => void cloneHere()}>
          {busy === 'clone' ? 'Kuruluyor…' : 'Bu yapıyla yeni sunucu kur'}
        </button>
        <button type="button" className={`${btn} bg-surface-container-high text-on-surface`} disabled={!!busy} onClick={() => pick('new')}>
          Dosyadan yeni sunucu kur
        </button>
        {isOwner && (
          <button type="button" className={`${btn} bg-surface-container-high text-on-surface`} disabled={!!busy} onClick={() => pick('restore')}>
            {busy === 'restore' ? 'Yükleniyor…' : 'Yedeği bu sunucuya yükle'}
          </button>
        )}
      </div>
      <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => void onFile(e.target.files?.[0] ?? undefined).finally(() => (e.target.value = ''))} />
      {msg && <p className={`font-body-sm ${msg.ok ? 'text-on-surface' : 'text-error'}`}>{msg.text}</p>}
    </div>
  );
}
