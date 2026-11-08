'use client';

import { useCallback, useEffect, useState } from 'react';
import type { GuildLevelConfigDto, LevelRoleReward, MemberLevelDto } from '@dracord/types';
import { cn } from '../lib/cn';
import { Avatar } from './Avatar';

/** @dracord/sdk DracordClient alt kümesi */
export type LevelsClient = {
  getLevelLeaderboard(guildId: string, opts?: { limit?: number; offset?: number }): Promise<MemberLevelDto[]>;
  getMyLevel(guildId: string): Promise<MemberLevelDto>;
  getLevelConfig(guildId: string): Promise<GuildLevelConfigDto>;
  updateLevelConfig(
    guildId: string,
    patch: Partial<Omit<GuildLevelConfigDto, 'guildId'>>,
  ): Promise<GuildLevelConfigDto>;
  resyncLevelRewards(guildId: string): Promise<{ updated: number }>;
};

export function LevelBar({ dto, className }: { dto: Pick<MemberLevelDto, 'level' | 'xpIntoLevel' | 'xpForNext'>; className?: string }) {
  const pct = dto.xpForNext > 0 ? Math.min(100, (dto.xpIntoLevel / dto.xpForNext) * 100) : 0;
  return (
    <div className={cn('flex items-center gap-2 min-w-0', className)}>
      <span className="shrink-0 rounded-md bg-primary-container/20 px-1.5 py-0.5 font-label-sm text-primary-container tabular-nums">
        Sv. {dto.level}
      </span>
      <div
        className="h-1.5 flex-1 min-w-[3rem] rounded-full bg-surface-container-highest overflow-hidden"
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Seviye ${dto.level} ilerlemesi`}
      >
        <div className="h-full rounded-full bg-primary-container transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
      <span className="shrink-0 font-label-sm text-outline tabular-nums">
        {dto.xpIntoLevel}/{dto.xpForNext}
      </span>
    </div>
  );
}

const medal = (rank?: number | null) =>
  rank === 1 ? 'text-dracula-yellow' : rank === 2 ? 'text-on-surface-variant' : rank === 3 ? 'text-dracula-orange' : 'text-outline';

/**
 * Sunucu seviyeleri: lider tablosu + (yöneticiye) ayarlar.
 * Web, desktop ortak. Mobilde ayrı RN bileşeni var.
 */
export function LevelsPanel({
  client,
  guildId,
  canManage = false,
  roles = [],
  channels = [],
  mode = 'all',
  className,
}: {
  client: LevelsClient;
  guildId: string;
  canManage?: boolean;
  roles?: Array<{ id: string; name: string; color?: string | null }>;
  channels?: Array<{ id: string; name: string }>;
  /** leaderboard: yalnız tablo · settings: yalnız ayar · all: ikisi */
  mode?: 'all' | 'leaderboard' | 'settings';
  className?: string;
}) {
  const [me, setMe] = useState<MemberLevelDto | null>(null);
  const [rows, setRows] = useState<MemberLevelDto[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [cfg, setCfg] = useState<GuildLevelConfigDto | null>(null);
  const [draft, setDraft] = useState<GuildLevelConfigDto | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const showBoard = mode !== 'settings';
  const showSettings = canManage && mode !== 'leaderboard';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [board, mine, conf] = await Promise.all([
        showBoard ? client.getLevelLeaderboard(guildId, { limit: 25 }) : Promise.resolve([]),
        showBoard ? client.getMyLevel(guildId).catch(() => null) : Promise.resolve(null),
        client.getLevelConfig(guildId).catch(() => null),
      ]);
      setRows(board);
      setHasMore(board.length >= 25);
      setMe(mine);
      setCfg(conf);
      setDraft(conf);
    } finally {
      setLoading(false);
    }
  }, [client, guildId, showBoard]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadMore = async () => {
    const more = await client.getLevelLeaderboard(guildId, { limit: 25, offset: rows.length });
    setRows((r) => [...r, ...more]);
    setHasMore(more.length >= 25);
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    setMsg(null);
    try {
      const { guildId: _g, ...patch } = draft;
      void _g;
      const next = await client.updateLevelConfig(guildId, patch);
      setCfg(next);
      setDraft(next);
      setMsg('Kaydedildi.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  const resync = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const r = await client.resyncLevelRewards(guildId);
      setMsg(`${r.updated} üyeye eksik ödül rolleri verildi.`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Uygulanamadı');
    } finally {
      setSaving(false);
    }
  };

  const setReward = (i: number, patch: Partial<LevelRoleReward>) =>
    setDraft((d) =>
      d ? { ...d, roleRewards: d.roleRewards.map((r, j) => (j === i ? { ...r, ...patch } : r)) } : d,
    );

  const dirty = JSON.stringify(cfg) !== JSON.stringify(draft);

  return (
    <div className={cn('flex flex-col gap-space-lg', className)}>
      {showBoard && (
        <section className="flex flex-col gap-space-sm">
          {cfg && !cfg.enabled && (
            <p className="font-body-sm text-outline">Bu sunucuda seviye sistemi kapalı.</p>
          )}
          {me && (
            <div className="rounded-xl bg-surface-container-low border border-surface-container-highest p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-label-md text-on-surface">Senin seviyen</span>
                <span className="font-label-sm text-outline">
                  {me.rank ? `#${me.rank} · ` : ''}
                  {me.messageCount} mesaj · {me.voiceMinutes} dk ses
                </span>
              </div>
              <LevelBar dto={me} />
            </div>
          )}
          {loading ? (
            <p className="font-body-sm text-outline">Yükleniyor…</p>
          ) : rows.length === 0 ? (
            <p className="font-body-sm text-outline">Henüz kimse XP kazanmadı. Mesaj yaz, seste takıl!</p>
          ) : (
            <ol className="flex flex-col gap-1">
              {rows.map((r) => (
                <li
                  key={r.userId}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-2 py-1.5',
                    me?.userId === r.userId ? 'bg-primary-container/10' : 'hover:bg-surface-container',
                  )}
                >
                  <span className={cn('w-7 text-right font-label-md tabular-nums', medal(r.rank))}>
                    {r.rank}
                  </span>
                  <Avatar displayName={r.displayName || r.username || '?'} imageUrl={r.avatarUrl} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="font-label-md text-on-surface truncate">{r.displayName || r.username}</p>
                    <LevelBar dto={r} />
                  </div>
                  <span className="shrink-0 font-label-sm text-outline tabular-nums w-16 text-right">
                    {r.xp.toLocaleString('tr-TR')} XP
                  </span>
                </li>
              ))}
            </ol>
          )}
          {hasMore && (
            <button
              type="button"
              onClick={() => void loadMore()}
              className="self-center h-8 px-4 rounded-lg bg-surface-container-high font-label-sm text-on-surface hover:bg-surface-container-highest"
            >
              Daha fazla
            </button>
          )}
        </section>
      )}

      {showSettings && draft && (
        <section className="flex flex-col gap-space-md rounded-xl border border-surface-container-highest bg-surface-container-low p-space-md">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-headline-md text-on-surface">Seviye ayarları</h3>
            <label className="flex items-center gap-2 font-label-md text-on-surface cursor-pointer">
              <input
                type="checkbox"
                checked={draft.enabled}
                onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
                className="accent-[var(--color-primary-container)] w-4 h-4"
              />
              Açık
            </label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-sm">
            {(
              [
                ['messageXpMin', 'Mesaj XP (en az)', 0, 100],
                ['messageXpMax', 'Mesaj XP (en çok)', 0, 200],
                ['voiceXpPerMinute', 'Ses XP / dakika', 0, 50],
              ] as const
            ).map(([k, label, lo, hi]) => (
              <label key={k} className="flex flex-col gap-1">
                <span className="font-label-sm text-on-surface-variant">{label}</span>
                <input
                  type="number"
                  min={lo}
                  max={hi}
                  value={draft[k]}
                  onChange={(e) => setDraft({ ...draft, [k]: Number(e.target.value) })}
                  className="h-9 rounded-lg bg-surface-container-highest px-2 font-body-md text-on-surface outline-none"
                />
              </label>
            ))}
          </div>
          <p className="font-body-sm text-outline -mt-2">
            Mesaj XP'si kişi başı dakikada bir verilir. AFK kanalında ses XP'si yok.
          </p>
          <label className="flex items-center gap-2 font-body-sm text-on-surface">
            <input
              type="checkbox"
              checked={draft.announce === 'notification'}
              onChange={(e) => setDraft({ ...draft, announce: e.target.checked ? 'notification' : 'off' })}
              className="w-4 h-4"
            />
            Seviye atlayınca üyeye bildirim gönder
          </label>

          <div className="flex flex-col gap-2">
            <span className="font-label-md text-on-surface">Rol ödülleri</span>
            {draft.roleRewards.length === 0 && (
              <p className="font-body-sm text-outline">Henüz ödül yok. Örn. seviye 5 → "Aktif üye".</p>
            )}
            {draft.roleRewards.map((r, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="font-label-sm text-on-surface-variant">Seviye</span>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={r.level}
                  onChange={(e) => setReward(i, { level: Number(e.target.value) })}
                  className="h-9 w-20 rounded-lg bg-surface-container-highest px-2 font-body-md text-on-surface outline-none"
                  aria-label="Ödül seviyesi"
                />
                <select
                  value={r.roleId}
                  onChange={(e) => setReward(i, { roleId: e.target.value })}
                  className="h-9 flex-1 min-w-0 rounded-lg bg-surface-container-highest px-2 font-body-md text-on-surface outline-none"
                  aria-label="Ödül rolü"
                >
                  <option value="">Rol seç…</option>
                  {roles.map((ro) => (
                    <option key={ro.id} value={ro.id}>
                      {ro.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() =>
                    setDraft({ ...draft, roleRewards: draft.roleRewards.filter((_, j) => j !== i) })
                  }
                  className="h-9 w-9 rounded-lg flex items-center justify-center text-outline hover:text-error hover:bg-surface-container"
                  aria-label="Ödülü kaldır"
                >
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                </button>
              </div>
            ))}
            <button
              type="button"
              disabled={!roles.length}
              onClick={() =>
                setDraft({
                  ...draft,
                  roleRewards: [...draft.roleRewards, { level: 5, roleId: roles[0]?.id ?? '' }],
                })
              }
              className="self-start h-8 px-3 rounded-lg bg-surface-container-high font-label-sm text-on-surface hover:bg-surface-container-highest disabled:opacity-50"
            >
              + Ödül ekle
            </button>
          </div>

          {channels.length > 0 && (
            <details className="rounded-lg bg-surface-container px-3 py-2">
              <summary className="font-label-md text-on-surface cursor-pointer">
                XP kazanılmayan kanallar ({draft.noXpChannelIds.length})
              </summary>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1 max-h-48 overflow-y-auto">
                {channels.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 font-body-sm text-on-surface">
                    <input
                      type="checkbox"
                      checked={draft.noXpChannelIds.includes(c.id)}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          noXpChannelIds: e.target.checked
                            ? [...draft.noXpChannelIds, c.id]
                            : draft.noXpChannelIds.filter((x) => x !== c.id),
                        })
                      }
                    />
                    <span className="truncate">#{c.name}</span>
                  </label>
                ))}
              </div>
            </details>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={saving || !dirty || draft.roleRewards.some((r) => !r.roleId)}
              onClick={() => void save()}
              className="h-9 px-4 rounded-lg bg-primary-container text-on-primary-container font-label-md disabled:opacity-60"
            >
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
            {cfg && cfg.roleRewards.length > 0 && (
              <button
                type="button"
                disabled={saving}
                onClick={() => void resync()}
                className="h-9 px-4 rounded-lg bg-surface-container-high font-label-md text-on-surface hover:bg-surface-container-highest disabled:opacity-60"
                title="Ödül eşiğini geçmiş ama rolü olmayan üyelere rolü ver"
              >
                Ödülleri mevcut üyelere uygula
              </button>
            )}
            {msg && <span className="font-body-sm text-on-surface-variant">{msg}</span>}
          </div>
        </section>
      )}
    </div>
  );
}
