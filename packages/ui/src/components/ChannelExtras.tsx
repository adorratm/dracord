'use client';

import { useEffect, useState } from 'react';
import type { ChannelFollowDto, ChannelSummary } from '@dracord/types';
import { Modal } from './Modal';

export interface ChannelExtrasClient {
  updateChannel(channelId: string, data: { slowModeSec?: number; isAnnouncement?: boolean }): Promise<ChannelSummary>;
  listChannelFollowers(channelId: string): Promise<ChannelFollowDto[]>;
  listChannelFollowing(channelId: string): Promise<ChannelFollowDto[]>;
  followChannel(sourceChannelId: string, targetChannelId: string): Promise<ChannelFollowDto>;
  unfollowChannel(followId: string): Promise<{ ok: true }>;
  getGuildChannels(guildId: string): Promise<ChannelSummary[]>;
}

export const SLOW_MODE_OPTIONS: Array<{ sec: number; label: string }> = [
  { sec: 0, label: 'Kapalı' },
  { sec: 5, label: '5 sn' },
  { sec: 10, label: '10 sn' },
  { sec: 30, label: '30 sn' },
  { sec: 60, label: '1 dk' },
  { sec: 300, label: '5 dk' },
  { sec: 900, label: '15 dk' },
  { sec: 3600, label: '1 saat' },
  { sec: 21600, label: '6 saat' },
];

export const slowModeLabel = (sec: number | undefined): string | null =>
  sec && sec > 0 ? (SLOW_MODE_OPTIONS.find((o) => o.sec === sec)?.label ?? `${sec} sn`) : null;

const field =
  'w-full rounded-lg border border-outline-variant/60 bg-surface-container-low px-3 py-2 font-body-md text-on-surface outline-none focus:border-primary';

/** B8 — in the channel edit dialog (text channels): slow mode, announcement, followers */
export function ChannelExtrasSettings({
  client,
  channel,
  onUpdated,
}: {
  client: ChannelExtrasClient;
  channel: ChannelSummary;
  onUpdated?: (c: ChannelSummary) => void;
}) {
  const [slow, setSlow] = useState(channel.slowModeSec ?? 0);
  const [ann, setAnn] = useState(!!channel.isAnnouncement);
  const [followers, setFollowers] = useState<ChannelFollowDto[]>([]);
  const [following, setFollowing] = useState<ChannelFollowDto[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    setSlow(channel.slowModeSec ?? 0);
    setAnn(!!channel.isAnnouncement);
    void client.listChannelFollowers(channel.id).then(setFollowers).catch(() => setFollowers([]));
    void client.listChannelFollowing(channel.id).then(setFollowing).catch(() => setFollowing([]));
  }, [client, channel.id, channel.slowModeSec, channel.isAnnouncement]);

  if (channel.type !== 'TEXT') return null;

  const save = async (patch: { slowModeSec?: number; isAnnouncement?: boolean }) => {
    setMsg(null);
    try {
      const c = await client.updateChannel(channel.id, patch);
      onUpdated?.(c);
      setMsg({ ok: true, text: 'Kaydedildi' });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'Kaydedilemedi' });
    }
  };

  return (
    <div className="mt-space-md space-y-space-sm rounded-xl bg-surface-container-low p-3">
      <label className="block space-y-1">
        <span className="font-label-sm text-on-surface-variant">Yavaş mod</span>
        <select
          className={field}
          value={slow}
          onChange={(e) => {
            const v = Number(e.target.value);
            setSlow(v);
            void save({ slowModeSec: v });
          }}
        >
          {SLOW_MODE_OPTIONS.map((o) => (
            <option key={o.sec} value={o.sec}>
              {o.label}
            </option>
          ))}
        </select>
        <span className="block font-body-sm text-outline">Bir üye bu kanala bu sıklıktan fazla yazamaz. Moderatörler muaf.</span>
      </label>
      <label className="flex items-start gap-2 cursor-pointer">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 accent-primary-container"
          checked={ann}
          onChange={(e) => {
            setAnn(e.target.checked);
            void save({ isAnnouncement: e.target.checked });
          }}
        />
        <span>
          <span className="block font-body-md text-on-surface">Duyuru kanalı</span>
          <span className="block font-body-sm text-on-surface-variant">
            Başka sunucular bu kanalı takip edebilir; buraya yazılan her mesaj onların kanalına da düşer.
          </span>
        </span>
      </label>
      {followers.length ? (
        <div>
          <p className="font-label-sm text-outline">Takip eden kanallar ({followers.length})</p>
          <ul className="mt-1 space-y-1">
            {followers.map((f) => (
              <li key={f.id} className="flex items-center gap-2 font-body-sm text-on-surface">
                <span className="min-w-0 flex-1 truncate">
                  {f.targetGuildName} › #{f.targetChannelName}
                </span>
                <button type="button" className="text-error font-label-sm" onClick={() => void client.unfollowChannel(f.id).then(() => setFollowers((x) => x.filter((y) => y.id !== f.id)))}>
                  Kaldır
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {following.length ? (
        <div>
          <p className="font-label-sm text-outline">Bu kanalın takip ettikleri</p>
          <ul className="mt-1 space-y-1">
            {following.map((f) => (
              <li key={f.id} className="flex items-center gap-2 font-body-sm text-on-surface">
                <span className="min-w-0 flex-1 truncate">
                  {f.sourceGuildName} › #{f.sourceChannelName}
                </span>
                <button type="button" className="text-error font-label-sm" onClick={() => void client.unfollowChannel(f.id).then(() => setFollowing((x) => x.filter((y) => y.id !== f.id)))}>
                  Takibi bırak
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {msg ? <p className={msg.ok ? 'font-body-sm text-dracula-green' : 'font-body-sm text-error'}>{msg.text}</p> : null}
    </div>
  );
}

/** B8 — header button on an announcement channel: send its posts to a channel of yours */
export function AnnouncementFollowButton({
  client,
  channel,
  guilds,
}: {
  client: ChannelExtrasClient;
  channel: ChannelSummary;
  /** servers the viewer is in (the API checks they can manage the target channel) */
  guilds: Array<{ id: string; name: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [guildId, setGuildId] = useState('');
  const [targets, setTargets] = useState<ChannelSummary[]>([]);
  const [targetId, setTargetId] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!guildId) {
      setTargets([]);
      return;
    }
    void client
      .getGuildChannels(guildId)
      .then((l) => setTargets(l.filter((c) => c.type === 'TEXT' && c.id !== channel.id)))
      .catch(() => setTargets([]));
    setTargetId('');
  }, [client, guildId, channel.id]);

  if (!channel.isAnnouncement) return null;
  const follow = async () => {
    setMsg(null);
    try {
      const f = await client.followChannel(channel.id, targetId);
      setMsg({ ok: true, text: `Takip ediliyor: ${f.targetGuildName} › #${f.targetChannelName}` });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'Takip edilemedi' });
    }
  };
  return (
    <>
      <button
        type="button"
        className="h-8 px-2 rounded-lg flex items-center gap-1 text-outline hover:bg-surface-container hover:text-on-surface font-label-sm"
        aria-label="Duyuru kanalını takip et"
        title="Bu duyuruları kendi sunucuna al"
        onClick={() => setOpen(true)}
      >
        <span className="material-symbols-outlined text-[18px]">campaign</span>
        Takip et
      </button>
      <Modal open={open} title={`#${channel.name} duyurularını takip et`} onClose={() => setOpen(false)}>
        <div className="space-y-space-sm">
          <p className="font-body-sm text-on-surface-variant">
            Bu kanala yazılan duyurular seçtiğin kanala da düşer. Hedef kanalda “Kanalları yönet” iznin olmalı.
          </p>
          <select className={field} value={guildId} onChange={(e) => setGuildId(e.target.value)} aria-label="Sunucu">
            <option value="">Sunucu seç…</option>
            {guilds.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <select className={field} value={targetId} onChange={(e) => setTargetId(e.target.value)} disabled={!guildId} aria-label="Kanal">
            <option value="">Kanal seç…</option>
            {targets.map((c) => (
              <option key={c.id} value={c.id}>
                #{c.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!targetId}
            onClick={() => void follow()}
            className="px-4 py-2 rounded-lg bg-primary-container text-on-primary-container font-label-md disabled:opacity-50"
          >
            Takip et
          </button>
          {msg ? <p className={msg.ok ? 'font-body-sm text-dracula-green' : 'font-body-sm text-error'}>{msg.text}</p> : null}
        </div>
      </Modal>
    </>
  );
}
