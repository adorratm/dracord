import { useState } from 'react';
import { colors } from '@dracord/app-theme';
import { useAuth } from '../auth';

export function OnboardingUsername({ onDone }: { onDone: () => void }) {
  const { client } = useAuth();
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div
      style={{
        height: '100%',
        display: 'grid',
        placeItems: 'center',
        background: colors.bg,
        color: colors.text,
        padding: 24,
      }}
    >
      <form
        style={{
          width: 'min(100%, 380px)',
          background: colors.surface,
          borderRadius: 14,
          padding: 24,
          border: `1px solid ${colors.surfaceHigh}`,
        }}
        onSubmit={(e) => {
          e.preventDefault();
          if (username.trim().length < 3) {
            setError('En az 3 karakter');
            return;
          }
          setBusy(true);
          setError(null);
          void client
            .confirmUsername(username.trim())
            .then(() => onDone())
            .catch((err) => setError(err instanceof Error ? err.message : 'Kaydedilemedi'))
            .finally(() => setBusy(false));
        }}
      >
        <h2 style={{ marginTop: 0 }}>Kullanıcı adı seç</h2>
        <p style={{ color: colors.textMuted, fontSize: 14 }}>
          Dracord’da görünecek benzersiz adını belirle.
        </p>
        {error && <p style={{ color: colors.danger }}>{error}</p>}
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="kullanici_adi"
          autoFocus
          style={{
            width: '100%',
            height: 42,
            borderRadius: 10,
            border: 'none',
            padding: '0 12px',
            background: colors.surfaceHigh,
            color: colors.text,
            marginBottom: 12,
          }}
        />
        <button
          type="submit"
          disabled={busy}
          style={{
            width: '100%',
            height: 42,
            border: 'none',
            borderRadius: 10,
            background: colors.primary,
            color: colors.primaryOn,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Devam
        </button>
      </form>
    </div>
  );
}
