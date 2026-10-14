import { useEffect, useState } from 'react';
import type { ChannelSummary, GuildInviteDto, PublicUser, RoleDto } from '@dracord/types';
import { colors } from '@dracord/app-theme';
import { useAuth } from '../auth';

export function GuildSettingsPage({
  guildId,
  onBack,
  onChannelsChanged,
}: {
  guildId: string;
  onBack: () => void;
  onChannelsChanged: () => void;
}) {
  const { client } = useAuth();
  const [name, setName] = useState('');
  const [roles, setRoles] = useState<RoleDto[]>([]);
  const [channels, setChannels] = useState<ChannelSummary[]>([]);
  const [members, setMembers] = useState<PublicUser[]>([]);
  const [invite, setInvite] = useState<GuildInviteDto | null>(null);
  const [tab, setTab] = useState<'general' | 'channels' | 'roles' | 'members' | 'invite'>('general');
  const [newChannel, setNewChannel] = useState('');
  const [newRole, setNewRole] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    void client.getGuild(guildId).then((g) => setName(g.name));
    void client.listGuildRoles(guildId).then(setRoles);
    void client.getGuildChannels(guildId).then(setChannels);
    void client.getGuildMembers(guildId).then(setMembers);
  }, [client, guildId]);

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <aside
        style={{
          width: 200,
          borderRight: `1px solid ${colors.surfaceHigh}`,
          padding: 12,
          background: colors.surface,
        }}
      >
        <button
          type="button"
          onClick={onBack}
          style={{
            border: 'none',
            background: 'transparent',
            color: colors.textMuted,
            cursor: 'pointer',
            marginBottom: 12,
          }}
        >
          ← Geri
        </button>
        {(
          [
            ['general', 'Genel'],
            ['channels', 'Kanallar'],
            ['roles', 'Roller'],
            ['members', 'Üyeler'],
            ['invite', 'Davet'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              border: 'none',
              borderRadius: 8,
              padding: '10px 12px',
              marginBottom: 4,
              background: tab === k ? colors.surfaceHigh : 'transparent',
              color: colors.text,
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            {label}
          </button>
        ))}
      </aside>
      <div style={{ flex: 1, padding: 24, overflow: 'auto' }}>
        {error && <p style={{ color: colors.danger }}>{error}</p>}
        {msg && <p style={{ color: colors.success }}>{msg}</p>}

        {tab === 'general' && (
          <>
            <h2 style={{ marginTop: 0 }}>Sunucu ayarları</h2>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={inputStyle}
            />
            <button
              type="button"
              style={primaryBtn}
              onClick={() => {
                setError(null);
                void client
                  .updateGuild(guildId, { name: name.trim() })
                  .then(() => setMsg('Kaydedildi'))
                  .catch((e) => setError(e instanceof Error ? e.message : 'Hata'));
              }}
            >
              Kaydet
            </button>
          </>
        )}

        {tab === 'channels' && (
          <>
            <h2 style={{ marginTop: 0 }}>Kanallar</h2>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input
                value={newChannel}
                onChange={(e) => setNewChannel(e.target.value)}
                placeholder="Yeni metin kanalı"
                style={{ ...inputStyle, marginBottom: 0, flex: 1 }}
              />
              <button
                type="button"
                style={primaryBtn}
                onClick={() => {
                  if (!newChannel.trim()) return;
                  void client
                    .createChannel(guildId, { name: newChannel.trim(), type: 'TEXT' })
                    .then(() => {
                      setNewChannel('');
                      void client.getGuildChannels(guildId).then(setChannels);
                      onChannelsChanged();
                    })
                    .catch((e) => setError(e instanceof Error ? e.message : 'Oluşturulamadı'));
                }}
              >
                Ekle
              </button>
            </div>
            {channels
              .filter((c) => c.type !== 'CATEGORY')
              .map((c) => (
                <div
                  key={c.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '8px 0',
                    borderBottom: `1px solid ${colors.surfaceHigh}`,
                  }}
                >
                  <span>
                    {c.type === 'VOICE' ? '🔊' : c.type === 'GAME' || c.type === 'WATCH_PARTY' ? '🎮' : '#'}{' '}
                    {c.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (!confirm(`#${c.name} silinsin mi?`)) return;
                      void client.deleteChannel(c.id).then(() => {
                        void client.getGuildChannels(guildId).then(setChannels);
                        onChannelsChanged();
                      });
                    }}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: colors.danger,
                      cursor: 'pointer',
                    }}
                  >
                    Sil
                  </button>
                </div>
              ))}
          </>
        )}

        {tab === 'roles' && (
          <>
            <h2 style={{ marginTop: 0 }}>Roller</h2>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                placeholder="Yeni rol"
                style={{ ...inputStyle, marginBottom: 0, flex: 1 }}
              />
              <button
                type="button"
                style={primaryBtn}
                onClick={() => {
                  if (!newRole.trim()) return;
                  void client
                    .createGuildRole(guildId, { name: newRole.trim() })
                    .then(() => {
                      setNewRole('');
                      void client.listGuildRoles(guildId).then(setRoles);
                    });
                }}
              >
                Ekle
              </button>
            </div>
            {roles.map((r) => (
              <div key={r.id} style={{ padding: '8px 0', borderBottom: `1px solid ${colors.surfaceHigh}` }}>
                <span style={{ color: r.color || colors.text }}>{r.name}</span>
              </div>
            ))}
          </>
        )}

        {tab === 'members' && (
          <>
            <h2 style={{ marginTop: 0 }}>Üyeler</h2>
            {members.map((m) => (
              <div
                key={m.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 0',
                  borderBottom: `1px solid ${colors.surfaceHigh}`,
                }}
              >
                <span>
                  {m.displayName} <span style={{ color: colors.textMuted }}>@{m.username}</span>
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    style={dangerBtn}
                    onClick={() => {
                      if (!confirm('Üye atılsın mı?')) return;
                      void client.kickGuildMember(guildId, m.id).then(() =>
                        client.getGuildMembers(guildId).then(setMembers),
                      );
                    }}
                  >
                    At
                  </button>
                  <button
                    type="button"
                    style={dangerBtn}
                    onClick={() => {
                      if (!confirm('Üye yasaklansın mı?')) return;
                      void client.banGuildMember(guildId, m.id).then(() =>
                        client.getGuildMembers(guildId).then(setMembers),
                      );
                    }}
                  >
                    Yasakla
                  </button>
                </div>
              </div>
            ))}
          </>
        )}

        {tab === 'invite' && (
          <>
            <h2 style={{ marginTop: 0 }}>Davet linki</h2>
            <button
              type="button"
              style={primaryBtn}
              onClick={() => {
                void client
                  .createInvite(guildId)
                  .then(setInvite)
                  .catch((e) => setError(e instanceof Error ? e.message : 'Davet oluşturulamadı'));
              }}
            >
              Davet oluştur
            </button>
            {invite && (
              <p style={{ marginTop: 16 }}>
                <code style={{ background: colors.surfaceHigh, padding: '8px 12px', borderRadius: 8 }}>
                  {invite.url || invite.code}
                </code>
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 360,
  height: 40,
  borderRadius: 10,
  border: 'none',
  padding: '0 12px',
  background: colors.surfaceHigh,
  color: colors.text,
  marginBottom: 12,
  display: 'block',
};

const primaryBtn: React.CSSProperties = {
  height: 40,
  padding: '0 16px',
  border: 'none',
  borderRadius: 10,
  background: colors.primary,
  color: colors.primaryOn,
  fontWeight: 700,
  cursor: 'pointer',
};

const dangerBtn: React.CSSProperties = {
  height: 28,
  padding: '0 8px',
  border: 'none',
  borderRadius: 6,
  background: colors.danger,
  color: '#fff',
  fontWeight: 600,
  cursor: 'pointer',
  fontSize: 12,
};
