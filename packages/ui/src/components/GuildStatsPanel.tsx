'use client';

import { useEffect, useMemo, useState } from 'react';
import { GUILD_STATS_RANGES, type GuildStatsDay, type GuildStatsDto, type GuildStatsRange } from '@dracord/types';
import { cn } from '../lib/cn';
import { Avatar } from './Avatar';

/** @dracord/sdk DracordClient alt kümesi */
export type GuildStatsClient = {
  getGuildStats(guildId: string, days?: GuildStatsRange): Promise<GuildStatsDto>;
};

type Metric = 'messages' | 'activeMembers' | 'voiceMinutes' | 'joins';
const METRICS: { id: Metric; label: string; unit: string }[] = [
  { id: 'messages', label: 'Mesaj', unit: 'mesaj' },
  { id: 'activeMembers', label: 'Aktif üye', unit: 'aktif üye' },
  { id: 'voiceMinutes', label: 'Ses', unit: 'dk ses' },
  { id: 'joins', label: 'Katılan', unit: 'katılan' },
];

const nf = new Intl.NumberFormat('tr-TR');
const fmtDay = (d: string, long = false) => {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y!, (m ?? 1) - 1, day).toLocaleDateString('tr-TR', long ? { day: 'numeric', month: 'long', weekday: 'short' } : { day: 'numeric', month: 'short' });
};
const fmtMinutes = (m: number) => (m >= 120 ? `${nf.format(Math.round(m / 60))} sa` : `${nf.format(m)} dk`);

function delta(cur: number, prev: number): { text: string; up: boolean } | null {
  if (prev <= 0) return null;
  const p = Math.round(((cur - prev) / prev) * 100);
  if (!Number.isFinite(p)) return null;
  return { text: `${p > 0 ? '+' : ''}${p}%`, up: p >= 0 };
}

/**
 * Sunucu istatistik paneli (B2) — web + desktop. MANAGE_GUILD gerekir (API denetler).
 */
export function GuildStatsPanel({ client, guildId, className }: { client: GuildStatsClient; guildId: string; className?: string }) {
  const [days, setDays] = useState<GuildStatsRange>(30);
  const [data, setData] = useState<GuildStatsDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [metric, setMetric] = useState<Metric>('messages');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    client
      .getGuildStats(guildId, days)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e instanceof Error ? e.message : 'İstatistikler yüklenemedi'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [client, guildId, days]);

  const t = data?.totals;
  const dMsg = data ? delta(data.totals.messages, data.previous.messages) : null;
  const dAct = data ? delta(data.totals.activeMembers, data.previous.activeMembers) : null;
  const peakHour = useMemo(() => {
    if (!data) return null;
    let best = -1;
    let h = 0;
    data.hourly.forEach((n, i) => {
      if (n > best) {
        best = n;
        h = i;
      }
    });
    return best > 0 ? h : null;
  }, [data]);

  return (
    <div className={cn('space-y-space-lg', className)}>
      {/* Filtre satırı — grafiklerin üstünde tek satır */}
      <div className="flex flex-wrap items-center gap-2">
        <div role="radiogroup" aria-label="Zaman aralığı" className="inline-flex rounded-lg bg-surface-container-high p-0.5">
          {GUILD_STATS_RANGES.map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={days === r}
              onClick={() => setDays(r)}
              className={cn(
                'px-3 py-1 rounded-md font-label-md transition-colors',
                days === r ? 'bg-surface-container-lowest text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface',
              )}
            >
              Son {r} gün
            </button>
          ))}
        </div>
        {loading && <span className="font-label-sm text-outline">Yükleniyor…</span>}
        {data && !loading && (
          <span className="font-label-sm text-outline">
            {new Date(data.generatedAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })} itibarıyla
          </span>
        )}
      </div>

      {error && <p className="font-body-sm text-error">{error}</p>}

      {data && t && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-space-sm">
            <StatTile label="Üye" value={nf.format(data.memberCount)} sub={t.joins || t.leaves ? `+${t.joins} / −${t.leaves}` : undefined} />
            <StatTile label="Mesaj" value={nf.format(t.messages)} delta={dMsg} />
            <StatTile label="Aktif üye" value={nf.format(t.activeMembers)} delta={dAct} sub="mesaj yazan" />
            <StatTile label="Ses" value={fmtMinutes(t.voiceMinutes)} sub={peakHour !== null ? `yoğun saat ${String(peakHour).padStart(2, '0')}:00` : undefined} />
          </div>

          <section className="rounded-xl bg-surface-container-low p-space-md space-y-space-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-body-md font-semibold text-on-surface">Günlük</h3>
              <div role="radiogroup" aria-label="Ölçü" className="inline-flex flex-wrap gap-1">
                {METRICS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    role="radio"
                    aria-checked={metric === m.id}
                    onClick={() => setMetric(m.id)}
                    className={cn(
                      'px-2.5 py-1 rounded-md font-label-sm',
                      metric === m.id ? 'bg-primary-container/20 text-on-surface' : 'text-on-surface-variant hover:bg-surface-container-high',
                    )}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <DailyBars days={data.daily} metric={metric} unit={METRICS.find((m) => m.id === metric)!.unit} />
            {(metric === 'voiceMinutes' || metric === 'joins') && data.trackingSince && data.trackingSince > data.daily[0]!.day && (
              <p className="font-label-sm text-outline">Bu ölçü {fmtDay(data.trackingSince, true)} tarihinden beri tutuluyor.</p>
            )}
            {(metric === 'voiceMinutes' || metric === 'joins') && !data.trackingSince && (
              <p className="font-label-sm text-outline">Bu ölçü yeni tutulmaya başladı; ilk veriler birkaç gün içinde görünür.</p>
            )}
          </section>

          <section className="rounded-xl bg-surface-container-low p-space-md space-y-space-sm">
            <h3 className="font-body-md font-semibold text-on-surface">Saatlere göre mesaj</h3>
            <HourBars hourly={data.hourly} />
          </section>

          <div className="grid gap-space-md md:grid-cols-2">
            <RankList
              title="En aktif kanallar"
              empty="Bu dönemde mesaj yok."
              rows={data.topChannels.map((c) => ({ key: c.channelId, label: `#${c.name}`, value: c.messages }))}
            />
            <RankList
              title="En çok yazanlar"
              empty="Bu dönemde mesaj yok."
              rows={data.topMembers.map((m) => ({
                key: m.userId,
                label: m.displayName,
                value: m.messages,
                icon: <Avatar imageUrl={m.avatarUrl} displayName={m.displayName} size="sm" />,
              }))}
            />
          </div>

          <details className="font-body-sm text-on-surface-variant">
            <summary className="cursor-pointer font-label-md text-on-surface-variant hover:text-on-surface">Tablo görünümü</summary>
            <div className="mt-2 max-h-72 overflow-auto rounded-lg border border-outline-variant/40">
              <table className="w-full text-left tabular-nums">
                <thead className="sticky top-0 bg-surface-container-high font-label-sm text-on-surface-variant">
                  <tr>
                    <th className="px-2 py-1">Gün</th>
                    <th className="px-2 py-1 text-right">Mesaj</th>
                    <th className="px-2 py-1 text-right">Aktif</th>
                    <th className="px-2 py-1 text-right">Ses (dk)</th>
                    <th className="px-2 py-1 text-right">Katılan</th>
                    <th className="px-2 py-1 text-right">Ayrılan</th>
                  </tr>
                </thead>
                <tbody>
                  {[...data.daily].reverse().map((d) => (
                    <tr key={d.day} className="border-t border-outline-variant/30">
                      <td className="px-2 py-1">{fmtDay(d.day)}</td>
                      <td className="px-2 py-1 text-right">{nf.format(d.messages)}</td>
                      <td className="px-2 py-1 text-right">{nf.format(d.activeMembers)}</td>
                      <td className="px-2 py-1 text-right">{nf.format(d.voiceMinutes)}</td>
                      <td className="px-2 py-1 text-right">{d.joins}</td>
                      <td className="px-2 py-1 text-right">{d.leaves}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </div>
  );
}

function StatTile({ label, value, sub, delta: d }: { label: string; value: string; sub?: string; delta?: { text: string; up: boolean } | null }) {
  return (
    <div className="rounded-xl bg-surface-container-low px-space-md py-space-sm">
      <div className="font-label-sm text-on-surface-variant">{label}</div>
      <div className="font-headline-md text-on-surface tabular-nums">{value}</div>
      <div className="font-label-sm text-outline flex items-center gap-1.5 min-h-[1.25rem]">
        {d && (
          <span className="inline-flex items-center gap-0.5 text-on-surface-variant" title="Önceki eşit döneme göre">
            <span className="material-symbols-outlined text-[14px]" aria-hidden>
              {d.up ? 'trending_up' : 'trending_down'}
            </span>
            {d.text}
          </span>
        )}
        {sub && <span className="truncate">{sub}</span>}
      </div>
    </div>
  );
}

/** Tek seri dikey çubuk — 2px boşluk, yuvarlak uç, üzerine gelince ipucu */
function Bars({
  values,
  labelFor,
  tickEvery,
  tickLabel,
  height = 140,
}: {
  values: number[];
  labelFor: (i: number) => string;
  tickEvery: number;
  tickLabel: (i: number) => string;
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...values);
  const n = values.length;
  return (
    <div className="relative select-none">
      <div className="absolute right-0 top-0 font-label-sm text-outline tabular-nums">{nf.format(max)}</div>
      <div className="flex items-end gap-[2px] border-b border-outline-variant/50" style={{ height }} onMouseLeave={() => setHover(null)}>
        {values.map((v, i) => (
          <div
            key={i}
            className="relative flex-1 h-full flex items-end cursor-default"
            onMouseEnter={() => setHover(i)}
            onFocus={() => setHover(i)}
            tabIndex={-1}
            aria-label={labelFor(i)}
          >
            <div
              className={cn('w-full rounded-t-[4px] transition-colors', hover === i ? 'bg-primary' : 'bg-primary-container')}
              style={{ height: v > 0 ? `${Math.max(2, (v / max) * 100)}%` : 0 }}
            />
          </div>
        ))}
      </div>
      {hover !== null && (
        <div
          className="pointer-events-none absolute -top-1 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-outline-variant/50 bg-surface-container-highest px-2 py-1 font-label-sm text-on-surface shadow"
          style={{ left: `${((hover + 0.5) / n) * 100}%` }}
        >
          {labelFor(hover)}
        </div>
      )}
      <div className="relative h-4 mt-1">
        {values.map((_, i) =>
          i % tickEvery === 0 ? (
            <span
              key={i}
              className="absolute -translate-x-1/2 font-label-sm text-outline whitespace-nowrap"
              style={{ left: `${((i + 0.5) / n) * 100}%` }}
            >
              {tickLabel(i)}
            </span>
          ) : null,
        )}
      </div>
    </div>
  );
}

function DailyBars({ days, metric, unit }: { days: GuildStatsDay[]; metric: Metric; unit: string }) {
  const values = days.map((d) => d[metric]);
  const every = days.length <= 7 ? 1 : days.length <= 30 ? 5 : 15;
  return (
    <Bars
      values={values}
      tickEvery={every}
      tickLabel={(i) => fmtDay(days[i]!.day)}
      labelFor={(i) =>
        `${fmtDay(days[i]!.day, true)} · ${metric === 'voiceMinutes' ? fmtMinutes(values[i]!) : `${nf.format(values[i]!)} ${unit}`}`
      }
    />
  );
}

function HourBars({ hourly }: { hourly: number[] }) {
  return (
    <Bars
      values={hourly}
      height={90}
      tickEvery={3}
      tickLabel={(i) => `${String(i).padStart(2, '0')}`}
      labelFor={(i) => `${String(i).padStart(2, '0')}:00–${String((i + 1) % 24).padStart(2, '0')}:00 · ${nf.format(hourly[i]!)} mesaj`}
    />
  );
}

function RankList({
  title,
  rows,
  empty,
}: {
  title: string;
  empty: string;
  rows: Array<{ key: string; label: string; value: number; icon?: React.ReactNode }>;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <section className="rounded-xl bg-surface-container-low p-space-md">
      <h3 className="font-body-md font-semibold text-on-surface mb-space-sm">{title}</h3>
      {rows.length === 0 ? (
        <p className="font-body-sm text-outline">{empty}</p>
      ) : (
        <ol className="space-y-1.5">
          {rows.map((r) => (
            <li key={r.key} className="space-y-0.5">
              <div className="flex items-center gap-2 font-body-sm">
                {r.icon}
                <span className="truncate text-on-surface flex-1">{r.label}</span>
                <span className="tabular-nums text-on-surface-variant">{nf.format(r.value)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-surface-container-highest overflow-hidden">
                <div className="h-full rounded-full bg-primary-container" style={{ width: `${(r.value / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
