'use client';

import { useState } from 'react';
import {
  SettingsPage,
  SettingsSection,
  SettingsToggle,
  SettingsNote,
} from '@/components/settings/SettingsControls';
import { useUserPreferences } from '@/lib/user-preferences';
import { newId } from '@/lib/totp';

export default function FamilyCenterPage() {
  const { prefs, setSection } = useUserPreferences();
  const [name, setName] = useState('');

  const createInvite = () => {
    const code = `FAM-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    setSection('family', { inviteCode: code });
  };

  const addMember = () => {
    const displayName = name.trim();
    if (!displayName) return;
    setSection('family', {
      members: [
        ...prefs.family.members,
        { id: newId('fam'), displayName, role: 'teen' },
      ],
    });
    setName('');
  };

  const removeMember = (id: string) => {
    setSection('family', {
      members: prefs.family.members.filter((m) => m.id !== id),
    });
  };

  const redeemInvite = () => {
    if (!prefs.family.inviteCode) return;
    setSection('family', {
      members: [
        ...prefs.family.members,
        {
          id: newId('fam'),
          displayName: `Davet (${prefs.family.inviteCode})`,
          role: 'parent',
        },
      ],
      inviteCode: null,
    });
  };

  return (
    <SettingsPage
      title="Aile Merkezi"
      description="Aile üyelerini ekle, davet oluştur ve kontrolleri yönet."
    >
      <SettingsSection title="Özet">
        <SettingsToggle
          label="Etkinlik özeti"
          description="Bağlı aile üyeleri için haftalık etkileşim özeti."
          checked={prefs.family.activitySummary}
          onChange={(v) => setSection('family', { activitySummary: v })}
        />
        <SettingsToggle
          label="Ebeveyn kontrolleri"
          checked={prefs.family.parentalControls}
          onChange={(v) => setSection('family', { parentalControls: v })}
        />
      </SettingsSection>
      <SettingsSection title="Davet">
        <div className="px-space-md py-space-md space-y-space-sm">
          {prefs.family.inviteCode ? (
            <>
              <p className="font-mono text-primary-container">{prefs.family.inviteCode}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    void navigator.clipboard.writeText(prefs.family.inviteCode!)
                  }
                  className="px-space-md py-space-sm rounded-lg bg-surface-container-high font-label-sm"
                >
                  Kopyala
                </button>
                <button
                  type="button"
                  onClick={redeemInvite}
                  className="px-space-md py-space-sm rounded-lg bg-primary-container text-on-primary-container font-label-sm"
                >
                  Daveti simüle et (üye ekle)
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={createInvite}
              className="px-space-md py-space-sm rounded-lg bg-primary-container text-on-primary-container font-label-sm"
            >
              Davet kodu oluştur
            </button>
          )}
        </div>
      </SettingsSection>
      <SettingsSection title="Üyeler">
        <div className="px-space-md py-space-md flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Görünen ad"
            className="flex-1 h-10 rounded-lg bg-surface-container-highest px-3 outline-none"
          />
          <button
            type="button"
            onClick={addMember}
            className="px-space-md rounded-lg bg-surface-container-high font-label-sm"
          >
            Ekle
          </button>
        </div>
        {prefs.family.members.length === 0 ? (
          <SettingsNote>Bağlı aile üyesi yok.</SettingsNote>
        ) : (
          <ul className="divide-y divide-surface-container-high">
            {prefs.family.members.map((m) => (
              <li
                key={m.id}
                className="px-space-md py-space-sm flex justify-between items-center"
              >
                <span>
                  {m.displayName}{' '}
                  <span className="text-outline font-label-sm">({m.role})</span>
                </span>
                <button
                  type="button"
                  onClick={() => removeMember(m.id)}
                  className="font-label-sm text-error hover:underline"
                >
                  Kaldır
                </button>
              </li>
            ))}
          </ul>
        )}
      </SettingsSection>
    </SettingsPage>
  );
}
