'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { getAccessToken, getRefreshToken, persistSession } from '@/lib/storage';

function normalizeUsername(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 32);
}

export default function ProfileSettingsPage() {
  const { user, client, setUser } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [bio, setBio] = useState('');
  const [accentColor, setAccentColor] = useState('#bd93f9');
  const [website, setWebsite] = useState('');
  const [github, setGithub] = useState('');
  const [twitter, setTwitter] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setDisplayName(user.displayName);
    setUsername(user.username);
    setUsernameAvailable(null);
    setBio(user.bio ?? '');
    setAccentColor(user.accentColor ?? user.bannerColor ?? '#bd93f9');
    setWebsite(user.socialLinks?.website ?? '');
    setGithub(user.socialLinks?.github ?? '');
    setTwitter(user.socialLinks?.twitter ?? '');
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const normalized = normalizeUsername(username);
    if (normalized.length < 2) {
      setUsernameAvailable(null);
      return;
    }
    if (normalized === user.username) {
      setUsernameAvailable(true);
      return;
    }
    const t = window.setTimeout(() => {
      setUsernameChecking(true);
      void client
        .checkUsernameAvailable(normalized)
        .then((r) => setUsernameAvailable(r.available))
        .catch(() => setUsernameAvailable(null))
        .finally(() => setUsernameChecking(false));
    }, 280);
    return () => window.clearTimeout(t);
  }, [username, user, client]);

  const usernameChanged =
    Boolean(user) && normalizeUsername(username) !== (user?.username ?? '');
  const usernameOk =
    normalizeUsername(username).length >= 2 &&
    (usernameAvailable === true || !usernameChanged);

  const save = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const normalized = normalizeUsername(username);
      if (normalized.length < 2) {
        throw new Error('Kullanıcı adı en az 2 karakter olmalı');
      }
      if (usernameChanged && usernameAvailable === false) {
        throw new Error('Bu kullanıcı adı alınmış');
      }

      let updated = await client.updateProfile({
        displayName,
        bio,
        accentColor,
        bannerColor: accentColor,
        socialLinks: {
          website: website || undefined,
          github: github || undefined,
          twitter: twitter || undefined,
        },
      });

      if (usernameChanged) {
        updated = await client.confirmUsername(normalized);
      }

      setUser(updated);
      setUsername(updated.username);
      const access = getAccessToken();
      const refresh = getRefreshToken();
      if (access && refresh) persistSession(access, refresh, updated);
      setMessage('Profil kaydedildi');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  const uploadAvatar = async (file: File) => {
    setSaving(true);
    setError(null);
    try {
      const uploaded = await client.uploadFile(file, 'avatars');
      const updated = await client.updateProfile({ avatarUrl: uploaded.url });
      setUser(updated);
      const access = getAccessToken();
      const refresh = getRefreshToken();
      if (access && refresh) persistSession(access, refresh, updated);
      setMessage('Avatar güncellendi');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Avatar yüklenemedi (S3 ayarlarını kontrol et)');
    } finally {
      setSaving(false);
    }
  };

  const uploadBanner = async (file: File) => {
    setSaving(true);
    setError(null);
    try {
      const uploaded = await client.uploadFile(file, 'banners');
      const updated = await client.updateProfile({ bannerUrl: uploaded.url });
      setUser(updated);
      const access = getAccessToken();
      const refresh = getRefreshToken();
      if (access && refresh) persistSession(access, refresh, updated);
      setMessage('Banner güncellendi');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Banner yüklenemedi');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl px-space-xl py-space-xl space-y-space-lg">
      <h2 className="font-headline-lg text-headline-lg text-on-surface">Profil</h2>
      <p className="font-body-md text-on-surface-variant">
        Avatar, kullanıcı adı, renk, bio ve sosyal bağlantılarını buradan düzenle.
      </p>

      <div
        className="h-28 rounded-xl relative overflow-hidden bg-surface-container-high"
        style={{
          backgroundColor: accentColor,
          backgroundImage: user?.bannerUrl ? `url(${user.bannerUrl})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <label className="absolute right-space-sm bottom-space-sm px-space-sm py-1 rounded-lg bg-black/50 text-white font-label-sm cursor-pointer">
          Banner
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadBanner(f);
            }}
          />
        </label>
      </div>

      <div className="flex items-center gap-space-md">
        <div className="relative">
          {user?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatarUrl} alt="" className="w-20 h-20 rounded-full object-cover" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-headline-lg">
              {(user?.displayName ?? '?').slice(0, 1)}
            </div>
          )}
          <label className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-surface-container-highest flex items-center justify-center cursor-pointer">
            <span className="material-symbols-outlined text-[16px]">photo_camera</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadAvatar(f);
              }}
            />
          </label>
        </div>
        <div>
          <p className="font-headline-md text-on-surface">{user?.displayName}</p>
          <p className="font-label-sm text-outline">@{user?.username}</p>
        </div>
      </div>

      <label className="flex flex-col gap-space-xs">
        <span className="font-label-sm text-on-surface-variant">Görünen ad</span>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="h-10 px-space-sm rounded-lg bg-surface-container-highest outline-none"
        />
      </label>

      <label className="flex flex-col gap-space-xs">
        <span className="font-label-sm text-on-surface-variant">Kullanıcı adı</span>
        <div className="flex items-center h-10 px-space-sm rounded-lg bg-surface-container-highest gap-1">
          <span className="text-outline font-body-md">@</span>
          <input
            value={username}
            onChange={(e) => setUsername(normalizeUsername(e.target.value))}
            autoComplete="username"
            spellCheck={false}
            maxLength={32}
            className="flex-1 bg-transparent outline-none font-body-md min-w-0"
          />
        </div>
        <span className="font-label-sm text-on-surface-variant">
          {usernameChecking
            ? 'Kontrol ediliyor…'
            : normalizeUsername(username).length < 2
              ? 'En az 2 karakter (a-z, 0-9, _)'
              : !usernameChanged
                ? 'Mevcut kullanıcı adın'
                : usernameAvailable === true
                  ? 'Kullanılabilir'
                  : usernameAvailable === false
                    ? 'Bu ad alınmış'
                    : 'Uygunluk kontrol ediliyor…'}
        </span>
      </label>

      <label className="flex flex-col gap-space-xs">
        <span className="font-label-sm text-on-surface-variant">Bio</span>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={3}
          maxLength={190}
          className="px-space-sm py-space-sm rounded-lg bg-surface-container-highest outline-none resize-none"
        />
      </label>

      <label className="flex flex-col gap-space-xs">
        <span className="font-label-sm text-on-surface-variant">Vurgu rengi</span>
        <input
          type="color"
          value={accentColor}
          onChange={(e) => setAccentColor(e.target.value)}
          className="h-10 w-24 bg-transparent"
        />
      </label>

      <div className="grid gap-space-md sm:grid-cols-3">
        <label className="flex flex-col gap-space-xs">
          <span className="font-label-sm text-on-surface-variant">Website</span>
          <input
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            className="h-10 px-space-sm rounded-lg bg-surface-container-highest outline-none"
          />
        </label>
        <label className="flex flex-col gap-space-xs">
          <span className="font-label-sm text-on-surface-variant">GitHub</span>
          <input
            value={github}
            onChange={(e) => setGithub(e.target.value)}
            className="h-10 px-space-sm rounded-lg bg-surface-container-highest outline-none"
          />
        </label>
        <label className="flex flex-col gap-space-xs">
          <span className="font-label-sm text-on-surface-variant">Twitter / X</span>
          <input
            value={twitter}
            onChange={(e) => setTwitter(e.target.value)}
            className="h-10 px-space-sm rounded-lg bg-surface-container-highest outline-none"
          />
        </label>
      </div>

      {message && <p className="text-dracula-green font-body-sm">{message}</p>}
      {error && <p className="text-error font-body-sm">{error}</p>}

      <button
        type="button"
        disabled={saving || !usernameOk}
        onClick={() => void save()}
        className="px-space-lg py-space-sm rounded-lg bg-primary-container text-on-primary-container disabled:opacity-50"
      >
        Kaydet
      </button>
    </div>
  );
}
