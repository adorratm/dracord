'use client';

import { useEffect, useRef, useState } from 'react';
import { SOUNDBOARD_LIMITS, type GuildSoundDto, type MessageAttachment } from '@dracord/types';
import { cn } from '../lib/cn';
import { getSoundboardVolume, setSoundboardVolume } from '../lib/use-soundboard';

export type SoundboardManageClient = {
  uploadFile(file: File, folder?: string): Promise<MessageAttachment>;
  createGuildSound(
    guildId: string,
    input: { name: string; emoji?: string | null; url: string; contentType: string; durationSec: number; volume?: number },
  ): Promise<GuildSoundDto>;
  deleteGuildSound(guildId: string, soundId: string): Promise<{ ok: true }>;
};

function readDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const a = new Audio();
    a.preload = 'metadata';
    a.onloadedmetadata = () => {
      const d = a.duration;
      URL.revokeObjectURL(url);
      Number.isFinite(d) ? resolve(d) : reject(new Error('Süre okunamadı'));
    };
    a.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Ses dosyası okunamadı'));
    };
    a.src = url;
  });
}

/** Ses odası kontrol çubuğu için soundboard düğmesi + açılır panel */
export function SoundboardButton({
  sounds,
  onPlay,
  guildId,
  canManage = false,
  manageClient,
  onChanged,
  disabled,
}: {
  sounds: GuildSoundDto[];
  onPlay: (soundId: string) => Promise<{ ok: boolean; error?: string }>;
  guildId: string;
  canManage?: boolean;
  manageClient?: SoundboardManageClient | null;
  onChanged?: () => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [vol, setVol] = useState(0.8);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('');
  const [busy, setBusy] = useState(false);
  const root = useRef<HTMLDivElement | null>(null);

  useEffect(() => setVol(getSoundboardVolume()), []);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const play = async (id: string) => {
    setMsg(null);
    const r = await onPlay(id);
    if (!r.ok) {
      setMsg(
        r.error === 'rate_limited'
          ? 'Biraz bekle…'
          : r.error === 'deafened'
            ? 'Sağırken çalamazsın'
            : r.error === 'not_in_channel'
              ? 'Önce ses kanalına katıl'
              : 'Çalınamadı',
      );
    }
  };

  const add = async () => {
    if (!manageClient || !file) return;
    setBusy(true);
    setMsg(null);
    try {
      if (!file.type.startsWith('audio/')) throw new Error('Yalnızca ses dosyası');
      if (file.size > SOUNDBOARD_LIMITS.maxBytes) throw new Error('Dosya en fazla 512 KB olabilir');
      const dur = await readDuration(file);
      if (dur > SOUNDBOARD_LIMITS.maxDurationSec) throw new Error(`Ses en fazla ${SOUNDBOARD_LIMITS.maxDurationSec} sn olabilir`);
      const up = await manageClient.uploadFile(file, 'sounds');
      await manageClient.createGuildSound(guildId, {
        name: name.trim() || file.name.replace(/\.[^.]+$/, '').slice(0, SOUNDBOARD_LIMITS.nameMax),
        emoji: emoji.trim() || null,
        url: up.url,
        contentType: up.contentType,
        durationSec: dur,
      });
      setAdding(false);
      setFile(null);
      setName('');
      setEmoji('');
      onChanged?.();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Eklenemedi');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!manageClient) return;
    await manageClient.deleteGuildSound(guildId, id).catch(() => undefined);
    onChanged?.();
  };

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        className={cn(
          'w-12 h-12 rounded-full flex items-center justify-center transition-colors duration-200 disabled:opacity-50',
          open
            ? 'bg-primary-container text-on-primary-container'
            : 'bg-surface-container-highest text-on-surface hover:bg-surface-bright',
        )}
        aria-label="Soundboard"
        aria-expanded={open}
      >
        <span className="material-symbols-outlined text-[24px]">graphic_eq</span>
      </button>
      {open && (
        <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-[60] w-[min(22rem,90vw)] rounded-xl bg-surface-container-high border border-surface-container-highest shadow-float p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="font-label-md text-on-surface">Soundboard</span>
            <label className="flex items-center gap-1.5 font-label-sm text-outline">
              <span className="material-symbols-outlined text-[16px]" aria-hidden>
                volume_up
              </span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={vol}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setVol(v);
                  setSoundboardVolume(v);
                }}
                aria-label="Soundboard ses düzeyi (yalnız sen)"
                className="w-20"
              />
            </label>
          </div>
          {sounds.length === 0 ? (
            <p className="font-body-sm text-outline">Bu sunucuda henüz ses yok.</p>
          ) : (
            <div className="grid grid-cols-3 gap-1.5 max-h-60 overflow-y-auto">
              {sounds.map((s) => (
                <div key={s.id} className="relative group">
                  <button
                    type="button"
                    onClick={() => void play(s.id)}
                    className="w-full h-12 rounded-lg bg-surface-container hover:bg-surface-container-highest px-1.5 flex items-center gap-1 text-left"
                    title={s.name}
                  >
                    <span className="text-[18px] shrink-0">{s.emoji || '🔊'}</span>
                    <span className="font-label-sm text-on-surface truncate">{s.name}</span>
                  </button>
                  {canManage && manageClient && (
                    <button
                      type="button"
                      onClick={() => void remove(s.id)}
                      className="absolute -top-1 -right-1 hidden group-hover:flex h-5 w-5 rounded-full bg-error text-on-error items-center justify-center"
                      aria-label={`${s.name} sesini sil`}
                    >
                      <span className="material-symbols-outlined text-[14px]">close</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {msg && <p className="font-label-sm text-error">{msg}</p>}
          {canManage && manageClient && sounds.length < SOUNDBOARD_LIMITS.maxSoundsPerGuild && (
            adding ? (
              <div className="flex flex-col gap-1.5 rounded-lg bg-surface-container p-2">
                <input
                  type="file"
                  accept="audio/*"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="font-body-sm text-on-surface"
                  aria-label="Ses dosyası (≤5 sn, ≤512 KB)"
                />
                <div className="flex gap-1.5">
                  <input
                    value={emoji}
                    onChange={(e) => setEmoji(e.target.value)}
                    placeholder="😀"
                    maxLength={4}
                    className="h-8 w-12 rounded-md bg-surface-container-highest px-2 text-center outline-none"
                    aria-label="Emoji"
                  />
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ses adı"
                    maxLength={SOUNDBOARD_LIMITS.nameMax}
                    className="h-8 flex-1 min-w-0 rounded-md bg-surface-container-highest px-2 font-body-sm text-on-surface outline-none"
                    aria-label="Ses adı"
                  />
                </div>
                <div className="flex gap-1.5 justify-end">
                  <button type="button" onClick={() => setAdding(false)} className="h-8 px-3 rounded-md font-label-sm text-on-surface-variant hover:bg-surface-container-high">
                    Vazgeç
                  </button>
                  <button
                    type="button"
                    disabled={!file || busy}
                    onClick={() => void add()}
                    className="h-8 px-3 rounded-md bg-primary-container text-on-primary-container font-label-sm disabled:opacity-60"
                  >
                    {busy ? 'Yükleniyor…' : 'Ekle'}
                  </button>
                </div>
                <p className="font-label-sm text-outline">En fazla 5 sn ve 512 KB.</p>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="h-8 rounded-lg bg-surface-container font-label-sm text-on-surface hover:bg-surface-container-highest"
              >
                + Ses ekle
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
