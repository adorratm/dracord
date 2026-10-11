'use client';

import { useEffect, useMemo, useState } from 'react';
import type { GuildSummary } from '@dracord/types';
import { guildBoostLevel } from '@dracord/types';
import { useAuth } from '@/components/AuthProvider';
import {
  SettingsPage,
  SettingsSection,
  SettingsNote,
} from '@/components/settings/SettingsControls';
import { useUserPreferences } from '@/lib/user-preferences';
import { newId } from '@/lib/totp';
import { cn } from '@dracord/ui';

const LEVELS = [
  {
    level: 1,
    boosts: 2,
    perks: ['+50 emoji slotu', '720p 60fps yayın', '10 MB yükleme', '128 kbps ses'],
  },
  {
    level: 2,
    boosts: 7,
    perks: ['+100 emoji', '1440p 60fps', '50 MB yükleme', '256 kbps ses', 'Sunucu afişi'],
  },
  {
    level: 3,
    boosts: 14,
    perks: ['+250 emoji', '100 MB yükleme', '384 kbps ses', 'Özel davet bağlantısı'],
  },
] as const;

const FAQ = [
  {
    q: 'Sunucu Takviyesi nedir?',
    a: 'Takviyeler topluluğuna özel avantajlar açar. Kredilerinle desteklediğin sunucunun seviyesi yükselir.',
  },
  {
    q: 'Nasıl takviye yaparım?',
    a: 'Aşağıdaki listeden bir sunucu seçip “Bu sunucuya takviye yap”a tıkla. Demo ortamında kredi satın alabilirsin.',
  },
  {
    q: 'Bir sunucuya birden fazla takviye verebilir miyim?',
    a: 'Şu an hesap başına sunucu başına bir takviye atanır. Kredini başka sunucuya taşıyabilirsin.',
  },
  {
    q: '3. seviyeden sonra da takviye yapabilir miyim?',
    a: 'Evet — ek takviyeler sayaca eklenir ve topluluğa desteğini gösterir.',
  },
];

export default function BoostPage() {
  const { client } = useAuth();
  const { prefs, setSection, update } = useUserPreferences();
  const [guilds, setGuilds] = useState<GuildSummary[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    void client.listGuilds().then(setGuilds).catch(() => setGuilds([]));
  }, [client]);

  const assigned = useMemo(
    () => new Set(prefs.billing.boostAssignments.map((a) => a.guildId)),
    [prefs.billing.boostAssignments],
  );

  const buy = () => {
    setSection('billing', {
      boostCredits: prefs.billing.boostCredits + 1,
      invoices: [
        {
          id: newId('inv'),
          label: 'Sunucu takviyesi (demo)',
          amount: '₺49',
          at: new Date().toISOString(),
        },
        ...prefs.billing.invoices,
      ].slice(0, 20),
    });
  };

  const reloadBilling = async () => {
    const settings = await client.getClientSettings();
    update({ billing: settings.billing });
    setGuilds(await client.listGuilds());
  };

  const boost = async (guildId: string) => {
    setBusyId(guildId);
    setError(null);
    try {
      await client.boostGuild(guildId);
      await reloadBilling();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Takviye yapılamadı');
    } finally {
      setBusyId(null);
    }
  };

  const unboost = async (guildId: string) => {
    setBusyId(guildId);
    setError(null);
    try {
      await client.unboostGuild(guildId);
      await reloadBilling();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Takviye kaldırılamadı');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <SettingsPage
      title="Sunucu Takviyesi"
      description="Takviye satın al (demo) ve sunucularına ata — seviyeler herkese görünür."
    >
      {error && <p className="px-space-md font-body-sm text-error">{error}</p>}

      <SettingsSection title="Krediler">
        <div className="px-space-md py-space-md flex items-center justify-between gap-space-md flex-wrap">
          <p className="font-body-md">
            Kullanılabilir: <strong>{prefs.billing.boostCredits}</strong>
          </p>
          <button
            type="button"
            onClick={buy}
            className="px-space-md py-space-sm rounded-lg bg-primary-container text-on-primary-container font-label-sm"
          >
            +1 Takviye al (demo)
          </button>
        </div>
      </SettingsSection>

      <div className="mx-space-md mb-space-md rounded-xl bg-gradient-to-r from-primary-container/40 to-secondary-container/30 border border-primary-container/30 px-4 py-3 flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className="material-symbols-outlined text-primary-container">diamond</span>
          <div>
            <p className="font-label-md text-on-surface">Nitro ile 2 takviye al!</p>
            <p className="font-body-sm text-on-surface-variant">
              Nitro planı demo olarak +2 kredi verir.
            </p>
          </div>
        </div>
        <button
          type="button"
          className="h-9 px-4 rounded-full bg-on-surface text-surface font-label-sm"
          onClick={() => {
            setSection('billing', {
              nitroPlan: 'nitro',
              boostCredits: prefs.billing.boostCredits + 2,
            });
          }}
        >
          Nitro Al
        </button>
      </div>

      <SettingsSection title="Takviye yapmak sunucuların işine yarayabilir">
        {guilds.length === 0 ? (
          <SettingsNote>Henüz sunucun yok.</SettingsNote>
        ) : (
          <ul className="divide-y divide-surface-container-highest">
            {guilds.map((g) => {
              const count = g.boostCount ?? 0;
              const level = g.boostLevel ?? guildBoostLevel(count);
              const mine = assigned.has(g.id);
              return (
                <li
                  key={g.id}
                  className="px-space-md py-space-md flex items-center gap-3 flex-wrap"
                >
                  <div className="w-10 h-10 rounded-full bg-surface-container-highest overflow-hidden flex items-center justify-center shrink-0">
                    {g.iconUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={g.iconUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="font-label-sm">{g.name.slice(0, 2)}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-label-md text-on-surface truncate">{g.name}</p>
                    <p className="font-body-sm text-on-surface-variant">
                      {count === 0
                        ? 'Takviye yok'
                        : `${count} takviye · Seviye ${level}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busyId === g.id || (!mine && prefs.billing.boostCredits < 1)}
                    onClick={() => void (mine ? unboost(g.id) : boost(g.id))}
                    className={cn(
                      'h-9 px-3 rounded-lg font-label-sm inline-flex items-center gap-1 disabled:opacity-50',
                      mine
                        ? 'bg-surface-container-highest text-on-surface'
                        : 'bg-primary-container text-on-primary-container',
                    )}
                  >
                    <span className="material-symbols-outlined text-[16px]">diamond</span>
                    {mine ? 'Takviyeyi kaldır' : 'Bu sunucuya takviye yap'}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </SettingsSection>

      <SettingsSection title="Avantajlar">
        <div className="overflow-x-auto px-space-md py-space-md">
          <table className="w-full min-w-[32rem] text-left font-body-sm">
            <thead>
              <tr className="text-on-surface-variant border-b border-surface-container-highest">
                <th className="py-2 pr-2 font-label-sm">Avantajlar</th>
                {LEVELS.map((l) => (
                  <th key={l.level} className="py-2 px-2 font-label-sm">
                    {l.level}. Seviye
                    <span className="block text-outline font-normal">{l.boosts} takviye</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ['Emoji slotları', '100', '150', '250'],
                ['Sticker', '15', '30', '60'],
                ['Ses panosu', '24', '36', '48'],
                ['Yayın', '720p60', '1440p60', '1440p60'],
                ['Ses kalitesi', '128kbps', '256kbps', '384kbps'],
                ['Yükleme', '10 MB', '50 MB', '100 MB'],
              ].map((row) => (
                <tr key={row[0]} className="border-b border-surface-container-highest/60">
                  {row.map((cell, i) => (
                    <td
                      key={i}
                      className={cn(
                        'py-2.5 pr-2',
                        i === 0 ? 'text-on-surface-variant' : 'text-on-surface font-semibold',
                      )}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SettingsSection>

      <SettingsSection title="Topluluğuna bir Takviye yap ve tanınır ol">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-space-md">
          {[
            { icon: 'diamond', t: 'Üye listesi simgesiyle desteğini göster' },
            { icon: 'star', t: 'Zamanla gelişen bir profil rozeti aç' },
            { icon: 'shield', t: 'Ayrıcalıklı Takviye Sahibi rolü kazan' },
            { icon: 'favorite', t: 'Topluluğuna olan desteğini göster' },
          ].map((c) => (
            <div
              key={c.t}
              className="rounded-xl bg-surface-container-highest/50 p-4 flex gap-3 items-start"
            >
              <span className="material-symbols-outlined text-primary-container">{c.icon}</span>
              <p className="font-body-sm text-on-surface">{c.t}</p>
            </div>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title="SSS">
        <div className="divide-y divide-surface-container-highest">
          {FAQ.map((item, i) => (
            <div key={item.q}>
              <button
                type="button"
                className="w-full flex items-center justify-between gap-2 px-space-md py-3 text-left font-label-md text-on-surface"
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
              >
                {item.q}
                <span className="material-symbols-outlined text-[20px] text-outline">
                  {openFaq === i ? 'expand_less' : 'expand_more'}
                </span>
              </button>
              {openFaq === i && (
                <p className="px-space-md pb-3 font-body-sm text-on-surface-variant">{item.a}</p>
              )}
            </div>
          ))}
        </div>
      </SettingsSection>
    </SettingsPage>
  );
}
