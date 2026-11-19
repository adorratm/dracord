'use client';

import { useEffect, useState } from 'react';
import { AVATAR_DECORATIONS, PROFILE_EFFECTS, type PublicUser } from '@dracord/types';
import { ensureProfileDecorStyles } from '../lib/profile-decor';
import { cn } from '../lib/cn';
import { Avatar } from './Avatar';

interface Props {
  user: Pick<PublicUser, 'displayName' | 'avatarUrl' | 'avatarDecoration' | 'profileEffect' | 'bannerColor' | 'accentColor'>;
  onSave: (patch: { avatarDecoration?: PublicUser['avatarDecoration']; profileEffect?: PublicUser['profileEffect'] }) => Promise<unknown>;
}

/** F1 — Ayarlar › Profil: avatar süsü + profil efekti (ücretsiz), canlı önizleme */
export function ProfileDecorPicker({ user, onSave }: Props) {
  const [deco, setDeco] = useState<PublicUser['avatarDecoration']>(user.avatarDecoration ?? null);
  const [fx, setFx] = useState<PublicUser['profileEffect']>(user.profileEffect ?? null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => ensureProfileDecorStyles(), []);
  useEffect(() => {
    setDeco(user.avatarDecoration ?? null);
    setFx(user.profileEffect ?? null);
  }, [user.avatarDecoration, user.profileEffect]);

  const save = async (patch: Parameters<Props['onSave']>[0]) => {
    setMsg(null);
    try {
      await onSave(patch);
      setMsg({ ok: true, text: 'Kaydedildi' });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'Kaydedilemedi' });
    }
  };
  const chip = (active: boolean, label: string, onClick: () => void, children: React.ReactNode) => (
    <button
      type="button"
      aria-pressed={active}
      title={label}
      aria-label={label}
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-1 rounded-xl border-2 p-2 w-[4.75rem] transition-colors',
        active ? 'border-primary bg-primary-container/10' : 'border-transparent bg-surface-container hover:border-outline',
      )}
    >
      {children}
      <span className="font-label-sm text-[11px] text-on-surface-variant truncate max-w-full">{label}</span>
    </button>
  );

  return (
    <div className="px-space-md py-space-md space-y-space-md">
      <div className="flex items-center gap-space-md">
        <div
          className="relative h-24 w-40 shrink-0 overflow-hidden rounded-xl"
          style={{ background: user.accentColor || user.bannerColor || 'linear-gradient(135deg,#44475a,#282a36)' }}
        >
          {fx ? <div className={cn('profile-fx', `profile-fx--${fx}`)} aria-hidden /> : null}
          <div className="absolute inset-0 grid place-items-center">
            <Avatar displayName={user.displayName} imageUrl={user.avatarUrl} size="lg" decoration={deco} />
          </div>
        </div>
        <p className="font-body-sm text-on-surface-variant">
          Süsler herkese görünür: üye listesinde, mesajlarda ve profil kartında. Ücretsiz; istediğin zaman değiştir.
        </p>
      </div>

      <div>
        <p className="font-label-sm uppercase tracking-wider text-outline mb-2">Avatar süsü</p>
        <div className="flex flex-wrap gap-2">
          {chip(!deco, 'Yok', () => {
            setDeco(null);
            void save({ avatarDecoration: null });
          }, <span className="material-symbols-outlined h-8 grid place-items-center text-outline">block</span>)}
          {AVATAR_DECORATIONS.map((d) =>
            chip(deco === d.id, d.label, () => {
              setDeco(d.id);
              void save({ avatarDecoration: d.id });
            }, <Avatar displayName={user.displayName} imageUrl={user.avatarUrl} size="md" decoration={d.id} className="my-1" />),
          )}
        </div>
      </div>

      <div>
        <p className="font-label-sm uppercase tracking-wider text-outline mb-2">Profil efekti</p>
        <div className="flex flex-wrap gap-2">
          {chip(!fx, 'Yok', () => {
            setFx(null);
            void save({ profileEffect: null });
          }, <span className="material-symbols-outlined h-8 grid place-items-center text-outline">block</span>)}
          {PROFILE_EFFECTS.map((e) =>
            chip(fx === e.id, e.label, () => {
              setFx(e.id);
              void save({ profileEffect: e.id });
            }, <span className="relative block h-8 w-12 overflow-hidden rounded-md bg-surface-container-highest"><span className={cn('profile-fx', `profile-fx--${e.id}`)} /></span>),
          )}
        </div>
      </div>
      {msg ? <p className={msg.ok ? 'font-body-sm text-dracula-green' : 'font-body-sm text-error'}>{msg.text}</p> : null}
    </div>
  );
}
