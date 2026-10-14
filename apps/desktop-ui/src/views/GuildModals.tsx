import { useState } from 'react';
import { colors } from '@dracord/app-theme';
import { useAuth } from '../auth';

export function CreateGuildModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (guildId: string) => void;
}) {
  const { client } = useAuth();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!open) return null;

  return (
    <Modal title="Sunucu oluştur" onClose={onClose}>
      {error && <p style={{ color: colors.danger }}>{error}</p>}
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Sunucu adı"
        style={inputStyle}
      />
      <button
        type="button"
        disabled={busy || name.trim().length < 2}
        style={primaryBtn}
        onClick={() => {
          setBusy(true);
          setError(null);
          void client
            .createGuild({ name: name.trim(), discoverable: true })
            .then((g) => {
              onCreated(g.id);
              onClose();
              setName('');
            })
            .catch((e) => setError(e instanceof Error ? e.message : 'Oluşturulamadı'))
            .finally(() => setBusy(false));
        }}
      >
        Oluştur
      </button>
    </Modal>
  );
}

export function JoinInviteModal({
  open,
  onClose,
  onJoined,
}: {
  open: boolean;
  onClose: () => void;
  onJoined: (guildId: string) => void;
}) {
  const { client } = useAuth();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!open) return null;

  return (
    <Modal title="Davet ile katıl" onClose={onClose}>
      {error && <p style={{ color: colors.danger }}>{error}</p>}
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Davet kodu veya link"
        style={inputStyle}
      />
      <button
        type="button"
        disabled={busy || !code.trim()}
        style={primaryBtn}
        onClick={() => {
          setBusy(true);
          setError(null);
          const raw = code.trim();
          const invite = raw.includes('/') ? raw.split('/').pop()! : raw;
          void client
            .joinInvite(invite)
            .then((g) => {
              onJoined(g.id);
              onClose();
              setCode('');
            })
            .catch((e) => setError(e instanceof Error ? e.message : 'Katılınamadı'))
            .finally(() => setBusy(false));
        }}
      >
        Katıl
      </button>
    </Modal>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 50,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(100%, 380px)',
          background: colors.surface,
          borderRadius: 14,
          padding: 20,
          border: `1px solid ${colors.surfaceHigh}`,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <strong>{title}</strong>
          <button type="button" onClick={onClose} style={{ border: 'none', background: 'transparent', color: colors.textMuted, cursor: 'pointer' }}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 40,
  borderRadius: 10,
  border: 'none',
  padding: '0 12px',
  background: colors.surfaceHigh,
  color: colors.text,
  marginBottom: 12,
};

const primaryBtn: React.CSSProperties = {
  width: '100%',
  height: 40,
  border: 'none',
  borderRadius: 10,
  background: colors.primary,
  color: colors.primaryOn,
  fontWeight: 700,
  cursor: 'pointer',
};
