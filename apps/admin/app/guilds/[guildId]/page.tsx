'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ChannelSummary, PublicUser } from '@dracord/types';
import { AdminShell } from '@/components/AdminShell';
import {
  getGuildDetail,
  listGuildChannels,
  listGuildMembers,
  listGuildMessages,
  listGuildVoice,
  type PlatformAdminGuildDetail,
  type PlatformAdminMessageRow,
  type PlatformAdminVoiceRow,
} from '@/lib/api';

export default function GuildDetailPage() {
  const params = useParams();
  const guildId = String(params.guildId ?? '');
  const [guild, setGuild] = useState<PlatformAdminGuildDetail | null>(null);
  const [channels, setChannels] = useState<ChannelSummary[]>([]);
  const [members, setMembers] = useState<PublicUser[]>([]);
  const [messages, setMessages] = useState<PlatformAdminMessageRow[]>([]);
  const [voice, setVoice] = useState<PlatformAdminVoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!guildId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [g, ch, mem, msg, vo] = await Promise.all([
          getGuildDetail(guildId),
          listGuildChannels(guildId),
          listGuildMembers(guildId),
          listGuildMessages(guildId, 80),
          listGuildVoice(guildId),
        ]);
        if (cancelled) return;
        setGuild(g);
        setChannels(ch);
        setMembers(mem);
        setMessages(msg);
        setVoice(vo);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Yüklenemedi');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    const timer = window.setInterval(() => {
      void listGuildVoice(guildId)
        .then((vo) => {
          if (!cancelled) setVoice(vo);
        })
        .catch(() => undefined);
    }, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [guildId]);

  const screenShares = voice.flatMap((v) =>
    v.screenSharers.map((s) => ({
      ...s,
      channelName: v.channelName,
      channelId: v.channelId,
    })),
  );

  return (
    <AdminShell>
      <div className="space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href="/guilds" className="text-sm text-dracula-cyan hover:underline">
              ← Sunucular
            </Link>
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
          {guild ? (
            <a
              href={`${(process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000').replace(/\/$/, '')}/channels/${guild.id}`}
              className="rounded border border-dracula-purple px-3 py-1.5 text-sm text-dracula-purple hover:bg-dracula-purple/10"
              target="_blank"
              rel="noreferrer"
            >
              Web’de aç
            </a>
          ) : null}
        </div>

        {error ? <p className="text-sm text-dracula-red">{error}</p> : null}
        {loading ? <p className="text-dracula-comment">Yükleniyor…</p> : null}

        {!loading && guild ? (
          <>
            <section className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-dracula-comment">
                Ses & ekran paylaşımı
              </h3>
              {voice.length === 0 ? (
                <p className="text-sm text-dracula-comment">Aktif ses kanalı yok</p>
              ) : (
                <ul className="space-y-3">
                  {voice.map((v) => (
                    <li
                      key={v.channelId}
                      className="rounded-lg border border-dracula-current bg-dracula-bg p-4"
                    >
                      <p className="font-medium text-dracula-fg">🔊 {v.channelName}</p>
                      <p className="mt-1 text-sm text-dracula-comment">
                        {v.members.map((m) => m.displayName).join(', ') || '—'}
                      </p>
                      {v.screenSharers.length > 0 ? (
                        <p className="mt-2 text-sm text-dracula-pink">
                          Ekran: {v.screenSharers.map((s) => s.displayName).join(', ')}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
              {screenShares.length > 0 ? (
                <p className="text-xs text-dracula-comment">
                  Toplam {screenShares.length} aktif ekran paylaşımı
                </p>
              ) : null}
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-dracula-comment">
                Kanallar
              </h3>
              <ul className="divide-y divide-dracula-current rounded-lg border border-dracula-current">
                {channels.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between px-4 py-2 text-sm"
                  >
                    <span className="text-dracula-fg">
                      {c.type === 'VOICE' ? '🔊' : c.type === 'FORUM' ? '💬' : '#'} {c.name}
                      {c.locked ? ' 🔒' : ''}
                      {c.hasPassword ? ' 🔑' : ''}
                    </span>
                    <span className="text-dracula-comment">{c.type}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-dracula-comment">
                Üyeler ({members.length})
              </h3>
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {members.map((m) => (
                  <li
                    key={m.id}
                    className="rounded border border-dracula-current px-3 py-2 text-sm"
                  >
                    <p className="font-medium text-dracula-fg">{m.displayName}</p>
                    <p className="text-dracula-comment">@{m.username}</p>
                  </li>
                ))}
              </ul>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-dracula-comment">
                Son mesajlar
              </h3>
              <ul className="divide-y divide-dracula-current rounded-lg border border-dracula-current">
                {messages.length === 0 ? (
                  <li className="px-4 py-6 text-center text-dracula-comment">Mesaj yok</li>
                ) : (
                  messages.map((m) => (
                    <li key={m.id} className="px-4 py-3 text-sm">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="font-medium text-dracula-purple">{m.authorName}</span>
                        <span className="text-dracula-comment">#{m.channelName}</span>
                        <span className="text-xs text-dracula-comment">
                          {new Date(m.createdAt).toLocaleString('tr-TR')}
                        </span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap break-words text-dracula-fg">
                        {m.content || '(boş / ek)'}
                      </p>
                    </li>
                  ))
                )}
              </ul>
            </section>
          </>
        ) : null}
      </div>
    </AdminShell>
  );
}
