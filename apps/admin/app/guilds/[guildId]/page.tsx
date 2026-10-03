'use client';

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChannelSummary, PublicUser, RoleDto } from '@dracord/types';
import { AdminShell } from '@/components/AdminShell';
import { AdminSearchBar } from '@/components/AdminSearchBar';
import {
  createChannel,
  createGuildRole,
  deleteChannel,
  deleteGuildRole,
  getGuildDetail,
  kickMember,
  listGuildChannels,
  listGuildMembers,
  listGuildMessages,
  listGuildRoles,
  listGuildVoice,
  updateChannel,
  updateGuild,
  updateGuildRole,
  type PlatformAdminGuildDetail,
  type PlatformAdminMessageRow,
  type PlatformAdminVoiceRow,
} from '@/lib/api';
import { getWebAppUrl } from '@/lib/site';

const ROLE_PERMS = [
  'ADMINISTRATOR',
  'MANAGE_GUILD',
  'MANAGE_CHANNELS',
  'MANAGE_ROLES',
  'MANAGE_MESSAGES',
  'KICK_MEMBERS',
  'BAN_MEMBERS',
  'MOVE_MEMBERS',
  'VIEW_CHANNELS',
  'SEND_MESSAGES',
] as const;

const WEB_URL = getWebAppUrl();
const GUILD_DETAIL_SEARCH_TYPES = ['messages', 'channels', 'users'] as const;

function isImage(ct: string) {
  return ct.startsWith('image/');
}
function isVideo(ct: string) {
  return ct.startsWith('video/');
}
function isAudio(ct: string) {
  return ct.startsWith('audio/');
}

export default function GuildDetailPage() {
  const params = useParams();
  const guildId = String(params.guildId ?? '');
  const [guild, setGuild] = useState<PlatformAdminGuildDetail | null>(null);
  const [channels, setChannels] = useState<ChannelSummary[]>([]);
  const [members, setMembers] = useState<PublicUser[]>([]);
  const [messages, setMessages] = useState<PlatformAdminMessageRow[]>([]);
  const [messagesHasMore, setMessagesHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const messagesScrollRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);
  const [roles, setRoles] = useState<RoleDto[]>([]);
  const [voice, setVoice] = useState<PlatformAdminVoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'overview' | 'channels' | 'roles' | 'members' | 'messages'>(
    'overview',
  );

  const [editName, setEditName] = useState('');
  const [editDiscoverable, setEditDiscoverable] = useState(false);
  const [editAfkChannelId, setEditAfkChannelId] = useState('');
  const [editAfkTimeout, setEditAfkTimeout] = useState('0');

  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelType, setNewChannelType] = useState<'TEXT' | 'VOICE' | 'FORUM'>('TEXT');
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleColor, setNewRoleColor] = useState('#99AAB5');

  const reload = useCallback(async () => {
    if (!guildId) return;
    setLoading(true);
    setError(null);
    try {
      const [g, ch, mem, msgPage, vo, ro] = await Promise.all([
        getGuildDetail(guildId),
        listGuildChannels(guildId),
        listGuildMembers(guildId),
        listGuildMessages(guildId, 40),
        listGuildVoice(guildId),
        listGuildRoles(guildId),
      ]);
      setGuild(g);
      setChannels(ch);
      setMembers(mem);
      setMessages(msgPage.items);
      setMessagesHasMore(msgPage.hasMore);
      stickToBottomRef.current = true;
      setVoice(vo);
      setRoles(ro);
      setEditName(g.name);
      setEditDiscoverable(Boolean(g.discoverable));
      setEditAfkChannelId(g.afkChannelId ?? '');
      setEditAfkTimeout(String(g.afkTimeoutMinutes ?? 0));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [guildId]);

  const loadOlderMessages = useCallback(async () => {
    if (!guildId || !messagesHasMore || loadingOlder || messages.length === 0) return;
    const oldest = messages[0];
    const el = messagesScrollRef.current;
    const prevHeight = el?.scrollHeight ?? 0;
    setLoadingOlder(true);
    try {
      const page = await listGuildMessages(guildId, 40, oldest.id);
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        const merged = [...page.items.filter((m) => !seen.has(m.id)), ...prev];
        return merged;
      });
      setMessagesHasMore(page.hasMore);
      requestAnimationFrame(() => {
        if (!el) return;
        el.scrollTop = el.scrollHeight - prevHeight;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Eski mesajlar yüklenemedi');
    } finally {
      setLoadingOlder(false);
    }
  }, [guildId, messages, messagesHasMore, loadingOlder]);

  useEffect(() => {
    if (tab !== 'messages') return;
    const el = messagesScrollRef.current;
    if (!el || !stickToBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, tab]);

  useEffect(() => {
    void reload();
    const timer = window.setInterval(() => {
      void listGuildVoice(guildId)
        .then((vo) => setVoice(vo))
        .catch(() => undefined);
    }, 8000);
    return () => window.clearInterval(timer);
  }, [guildId, reload]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'İşlem başarısız');
    } finally {
      setBusy(false);
    }
  };

  const tabs = [
    { id: 'overview' as const, label: 'Genel' },
    { id: 'channels' as const, label: 'Kanallar' },
    { id: 'roles' as const, label: 'Roller' },
    { id: 'members' as const, label: 'Üyeler' },
    { id: 'messages' as const, label: 'Mesajlar' },
  ];

  return (
    <AdminShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <a href="/guilds" className="cursor-pointer text-sm text-dracula-cyan hover:underline">
              ← Sunucular
            </a>
            <h2 className="mt-2 text-xl font-semibold text-dracula-fg">
              {guild?.name ?? 'Sunucu'}
            </h2>
            {guild ? (
              <p className="mt-1 text-sm text-dracula-comment">
                {guild.memberCount} üye · {guild.channelCount} kanal ·{' '}
                <code className="text-xs">{guild.id}</code>
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || loading}
              onClick={() => void reload()}
              className="rounded border border-dracula-current px-3 py-1.5 text-sm text-dracula-fg hover:bg-dracula-current/40"
            >
              Yenile
            </button>
            {guild ? (
              <a
                href={`${WEB_URL}/channels/${guild.id}`}
                className="rounded border border-dracula-purple px-3 py-1.5 text-sm text-dracula-purple hover:bg-dracula-purple/10"
                target="_blank"
                rel="noreferrer"
              >
                Web’de aç
              </a>
            ) : null}
          </div>
        </div>

        {error ? <p className="text-sm text-dracula-red whitespace-pre-wrap">{error}</p> : null}
        {loading ? <p className="text-dracula-comment">Yükleniyor…</p> : null}

        {!loading && guild ? (
          <>
            <AdminSearchBar
              guildId={guildId}
              placeholder="Bu sunucuda Elasticsearch ara…"
              types={GUILD_DETAIL_SEARCH_TYPES}
            />
            <div className="flex flex-wrap gap-2 border-b border-dracula-current pb-2">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`rounded px-3 py-1.5 text-sm ${
                    tab === t.id
                      ? 'bg-dracula-purple/30 text-dracula-purple'
                      : 'text-dracula-comment hover:text-dracula-fg'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tab === 'overview' ? (
              <div className="grid gap-6 lg:grid-cols-2">
                <section className="space-y-3 rounded-lg border border-dracula-current p-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-dracula-comment">
                    Sunucu düzenle
                  </h3>
                  <label className="block space-y-1 text-sm">
                    <span className="text-dracula-comment">Ad</span>
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="h-9 w-full rounded border border-dracula-current bg-dracula-bg px-2 text-dracula-fg"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm text-dracula-fg">
                    <input
                      type="checkbox"
                      checked={editDiscoverable}
                      onChange={(e) => setEditDiscoverable(e.target.checked)}
                    />
                    Keşfedilebilir
                  </label>
                  <label className="block space-y-1 text-sm">
                    <span className="text-dracula-comment">AFK kanalı</span>
                    <select
                      value={editAfkChannelId}
                      onChange={(e) => setEditAfkChannelId(e.target.value)}
                      className="h-9 w-full rounded border border-dracula-current bg-dracula-bg px-2 text-dracula-fg"
                    >
                      <option value="">Kapalı</option>
                      {channels
                        .filter((c) => c.type === 'VOICE')
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="block space-y-1 text-sm">
                    <span className="text-dracula-comment">AFK süre (dk)</span>
                    <select
                      value={editAfkTimeout}
                      onChange={(e) => setEditAfkTimeout(e.target.value)}
                      className="h-9 w-full rounded border border-dracula-current bg-dracula-bg px-2 text-dracula-fg"
                    >
                      {[0, 1, 5, 10, 15, 30, 60].map((m) => (
                        <option key={m} value={m}>
                          {m === 0 ? 'Kapalı' : `${m} dk`}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    disabled={busy}
                    className="rounded bg-dracula-purple px-3 py-1.5 text-sm text-dracula-fg disabled:opacity-50"
                    onClick={() =>
                      void run(async () => {
                        const updated = await updateGuild(guildId, {
                          name: editName.trim() || guild.name,
                          discoverable: editDiscoverable,
                          afkChannelId: editAfkChannelId || null,
                          afkTimeoutMinutes: Number(editAfkTimeout) || 0,
                        });
                        setGuild((prev) =>
                          prev
                            ? {
                                ...prev,
                                ...updated,
                              }
                            : prev,
                        );
                      })
                    }
                  >
                    Kaydet
                  </button>
                </section>

                <section className="space-y-3 rounded-lg border border-dracula-current p-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-dracula-comment">
                    Ses & ekran
                  </h3>
                  {voice.length === 0 ? (
                    <p className="text-sm text-dracula-comment">Aktif ses kanalı yok</p>
                  ) : (
                    <ul className="space-y-2">
                      {voice.map((v) => (
                        <li key={v.channelId} className="rounded border border-dracula-current p-3 text-sm">
                          <p className="font-medium text-dracula-fg">🔊 {v.channelName}</p>
                          <p className="mt-1 text-dracula-comment">
                            {v.members.map((m) => m.displayName).join(', ') || '—'}
                          </p>
                          {v.screenSharers.length > 0 ? (
                            <p className="mt-1 text-dracula-pink">
                              Ekran: {v.screenSharers.map((s) => s.displayName).join(', ')}
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            ) : null}

            {tab === 'channels' ? (
              <section className="space-y-4">
                <div className="flex flex-wrap items-end gap-2 rounded-lg border border-dracula-current p-4">
                  <label className="space-y-1 text-sm">
                    <span className="text-dracula-comment">Yeni kanal</span>
                    <input
                      value={newChannelName}
                      onChange={(e) => setNewChannelName(e.target.value)}
                      placeholder="kanal-adı"
                      className="block h-9 rounded border border-dracula-current bg-dracula-bg px-2 text-dracula-fg"
                    />
                  </label>
                  <select
                    value={newChannelType}
                    onChange={(e) =>
                      setNewChannelType(e.target.value as 'TEXT' | 'VOICE' | 'FORUM')
                    }
                    className="h-9 rounded border border-dracula-current bg-dracula-bg px-2 text-sm text-dracula-fg"
                  >
                    <option value="TEXT">Metin</option>
                    <option value="VOICE">Ses</option>
                    <option value="FORUM">Forum</option>
                  </select>
                  <button
                    type="button"
                    disabled={busy || !newChannelName.trim()}
                    className="h-9 rounded bg-dracula-purple px-3 text-sm disabled:opacity-50"
                    onClick={() =>
                      void run(async () => {
                        await createChannel(guildId, {
                          name: newChannelName.trim(),
                          type: newChannelType,
                        });
                        setNewChannelName('');
                      })
                    }
                  >
                    Oluştur
                  </button>
                </div>
                <ul className="divide-y divide-dracula-current rounded-lg border border-dracula-current">
                  {channels.map((c) => (
                    <li
                      key={c.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm"
                    >
                      <span className="text-dracula-fg">
                        {c.type === 'VOICE' ? '🔊' : c.type === 'FORUM' ? '💬' : '#'} {c.name}
                        {c.locked ? ' 🔒' : ''}
                      </span>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          className="text-xs text-dracula-cyan hover:underline"
                          onClick={() => {
                            const name = window.prompt('Yeni kanal adı', c.name);
                            if (!name?.trim()) return;
                            void run(async () => {
                              await updateChannel(c.id, { name: name.trim() });
                            });
                          }}
                        >
                          Yeniden adlandır
                        </button>
                        {c.type === 'VOICE' ? (
                          <button
                            type="button"
                            disabled={busy}
                            className="text-xs text-dracula-orange hover:underline"
                            onClick={() =>
                              void run(async () => {
                                await updateChannel(c.id, { locked: !c.locked });
                              })
                            }
                          >
                            {c.locked ? 'Kilidi aç' : 'Kilitle'}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          disabled={busy}
                          className="text-xs text-dracula-red hover:underline"
                          onClick={() => {
                            if (!window.confirm(`#${c.name} silinsin mi?`)) return;
                            void run(async () => {
                              await deleteChannel(c.id);
                            });
                          }}
                        >
                          Sil
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {tab === 'roles' ? (
              <section className="space-y-4">
                <div className="flex flex-wrap items-end gap-2 rounded-lg border border-dracula-current p-4">
                  <input
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                    placeholder="Rol adı"
                    className="h-9 rounded border border-dracula-current bg-dracula-bg px-2 text-sm text-dracula-fg"
                  />
                  <input
                    type="color"
                    value={newRoleColor}
                    onChange={(e) => setNewRoleColor(e.target.value)}
                    className="h-9 w-12"
                  />
                  <button
                    type="button"
                    disabled={busy || !newRoleName.trim()}
                    className="h-9 rounded bg-dracula-purple px-3 text-sm disabled:opacity-50"
                    onClick={() =>
                      void run(async () => {
                        await createGuildRole(guildId, {
                          name: newRoleName.trim(),
                          color: newRoleColor,
                          permissions: ['VIEW_CHANNELS', 'SEND_MESSAGES'],
                        });
                        setNewRoleName('');
                      })
                    }
                  >
                    Rol oluştur
                  </button>
                </div>
                <ul className="space-y-3">
                  {roles.map((role) => (
                    <li
                      key={role.id}
                      className="rounded-lg border border-dracula-current p-4 text-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: role.color }}
                          />
                          <span className="font-medium text-dracula-fg">{role.name}</span>
                          <span className="text-xs text-dracula-comment">pos {role.position}</span>
                        </div>
                        {role.name !== '@everyone' ? (
                          <button
                            type="button"
                            disabled={busy}
                            className="text-xs text-dracula-red hover:underline"
                            onClick={() => {
                              if (!window.confirm(`${role.name} silinsin mi?`)) return;
                              void run(async () => {
                                await deleteGuildRole(guildId, role.id);
                              });
                            }}
                          >
                            Sil
                          </button>
                        ) : null}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {ROLE_PERMS.map((perm) => {
                          const on = role.permissions.includes(perm);
                          return (
                            <button
                              key={perm}
                              type="button"
                              disabled={busy}
                              className={`rounded px-2 py-1 text-xs ${
                                on
                                  ? 'bg-dracula-green/20 text-dracula-green'
                                  : 'bg-dracula-current/40 text-dracula-comment'
                              }`}
                              onClick={() =>
                                void run(async () => {
                                  const next = on
                                    ? role.permissions.filter((p) => p !== perm)
                                    : [...role.permissions, perm];
                                  await updateGuildRole(guildId, role.id, {
                                    permissions: next,
                                  });
                                })
                              }
                            >
                              {perm}
                            </button>
                          );
                        })}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {tab === 'members' ? (
              <section className="space-y-3">
                <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {members.map((m) => (
                    <li
                      key={m.id}
                      className="rounded border border-dracula-current px-3 py-2 text-sm"
                    >
                      <p className="font-medium text-dracula-fg">{m.displayName}</p>
                      <p className="text-dracula-comment">@{m.username}</p>
                      <button
                        type="button"
                        disabled={busy || m.id === guild.ownerId}
                        className="mt-2 text-xs text-dracula-red hover:underline disabled:opacity-40"
                        onClick={() => {
                          if (!window.confirm(`${m.displayName} atılsın mı?`)) return;
                          void run(async () => {
                            await kickMember(guildId, m.id);
                          });
                        }}
                      >
                        At (kick)
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {tab === 'messages' ? (
              <section className="space-y-3">
                <p className="text-sm text-dracula-comment">
                  Aşağı = güncel. Yukarı kaydırınca geçmiş yüklenir (frontend sohbet akışı).
                </p>
                <div
                  ref={messagesScrollRef}
                  className="max-h-[min(70vh,40rem)] overflow-y-auto rounded-lg border border-dracula-current"
                  onScroll={(e) => {
                    const el = e.currentTarget;
                    const distBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
                    stickToBottomRef.current = distBottom < 80;
                    if (el.scrollTop < 80 && messagesHasMore && !loadingOlder) {
                      void loadOlderMessages();
                    }
                  }}
                >
                  {loadingOlder ? (
                    <p className="px-4 py-2 text-center text-xs text-dracula-comment">
                      Geçmiş yükleniyor…
                    </p>
                  ) : null}
                  {!messagesHasMore && messages.length > 0 ? (
                    <p className="px-4 py-2 text-center text-xs text-dracula-comment">
                      Başlangıç
                    </p>
                  ) : null}
                  <ul className="divide-y divide-dracula-current">
                  {messages.length === 0 ? (
                    <li className="px-4 py-6 text-center text-dracula-comment">Mesaj yok</li>
                  ) : (
                    messages.map((m) => (
                      <li key={m.id} className="px-4 py-3 text-sm space-y-2">
                        <div className="flex flex-wrap items-baseline gap-2">
                          <span className="font-medium text-dracula-purple">{m.authorName}</span>
                          <span className="text-dracula-comment">#{m.channelName}</span>
                          {m.threadRootId ? (
                            <span className="rounded bg-dracula-cyan/20 px-1.5 text-xs text-dracula-cyan">
                              thread
                            </span>
                          ) : null}
                          {m.type === 'heading' ? (
                            <span className="rounded bg-dracula-orange/20 px-1.5 text-xs text-dracula-orange">
                              başlık
                            </span>
                          ) : null}
                          <span className="text-xs text-dracula-comment">
                            {new Date(m.createdAt).toLocaleString('tr-TR')}
                          </span>
                        </div>
                        {m.content ? (
                          <p className="whitespace-pre-wrap break-words text-dracula-fg">
                            {m.content.startsWith('sticker:') ? (
                              <span className="text-dracula-pink">🎨 Sticker: {m.content}</span>
                            ) : (
                              m.content
                            )}
                          </p>
                        ) : null}
                        {m.poll ? (
                          <div className="rounded border border-dracula-current p-2 text-dracula-comment">
                            <p className="font-medium text-dracula-fg">📊 {m.poll.question}</p>
                            <ul className="mt-1 list-disc pl-5">
                              {m.poll.options.map((o) => (
                                <li key={o.id}>{o.text}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        {(m.attachments ?? []).length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {(m.attachments ?? []).map((a) => (
                              <div key={a.id} className="max-w-xs">
                                {isImage(a.contentType) ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={a.url}
                                    alt={a.filename}
                                    className="max-h-40 rounded border border-dracula-current object-contain"
                                  />
                                ) : isVideo(a.contentType) ? (
                                  <video
                                    src={a.url}
                                    controls
                                    className="max-h-48 rounded border border-dracula-current"
                                  />
                                ) : isAudio(a.contentType) ? (
                                  <audio src={a.url} controls className="w-full" />
                                ) : (
                                  <a
                                    href={a.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-dracula-cyan hover:underline"
                                  >
                                    📎 {a.filename}
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : null}
                        {(m.embeds ?? []).length > 0 ? (
                          <div className="space-y-2">
                            {(m.embeds ?? []).map((e, i) => (
                              <a
                                key={`${m.id}-e-${i}`}
                                href={e.url}
                                target="_blank"
                                rel="noreferrer"
                                className="block rounded border border-dracula-current p-2 hover:bg-dracula-current/20"
                              >
                                <p className="font-medium text-dracula-fg">
                                  {e.title || e.siteName || e.url}
                                </p>
                                {e.description ? (
                                  <p className="mt-1 line-clamp-2 text-dracula-comment">
                                    {e.description}
                                  </p>
                                ) : null}
                                {e.imageUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={e.imageUrl}
                                    alt=""
                                    className="mt-2 max-h-36 rounded object-contain"
                                  />
                                ) : null}
                              </a>
                            ))}
                          </div>
                        ) : null}
                        {!m.content &&
                        !(m.attachments ?? []).length &&
                        !(m.embeds ?? []).length &&
                        !m.poll ? (
                          <p className="text-dracula-comment">(boş)</p>
                        ) : null}
                      </li>
                    ))
                  )}
                </ul>
                </div>
              </section>
            ) : null}
          </>
        ) : null}
      </div>
    </AdminShell>
  );
}
