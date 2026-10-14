import { colors } from '@dracord/app-theme';
import { useAuth } from '../auth';
import { Draco } from '../components/Draco';

export function LoginPage() {
  const { loginGoogle } = useAuth();

  return (
    <div
      style={{
        minHeight: '100%',
        display: 'grid',
        placeItems: 'center',
        background: `radial-gradient(ellipse at 50% 0%, #2d1b4e 0%, ${colors.bg} 55%)`,
        padding: 24,
      }}
    >
      <div
        style={{
          width: 'min(100%, 400px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 20,
          textAlign: 'center',
        }}
      >
        <Draco size={168} />
        <div>
          <h1
            style={{
              margin: '0 0 8px',
              fontSize: 36,
              letterSpacing: '0.12em',
              fontWeight: 900,
            }}
          >
            <span style={{ color: colors.primary }}>DR</span>
            <span style={{ color: colors.success }}>ACO</span>
            <span style={{ color: colors.primary }}>RD</span>
          </h1>
          <p style={{ margin: 0, color: colors.textMuted, fontSize: 15, lineHeight: 1.45 }}>
            Dracula temalı topluluk sohbeti. Google ile gir, sunucularına katıl.
          </p>
        </div>

        <button
          type="button"
          onClick={loginGoogle}
          style={{
            width: '100%',
            height: 48,
            border: 'none',
            borderRadius: 12,
            background: colors.surfaceHigh,
            color: colors.text,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            boxShadow: '0 0 0 1px rgba(189,147,249,0.25)',
          }}
        >
          <GoogleIcon />
          Google ile giriş yap
        </button>

        <p style={{ margin: 0, color: colors.outline, fontSize: 12, maxWidth: 280 }}>
          Devam ederek Hizmet Şartları ve Gizlilik Politikası’nı kabul etmiş olursun.
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.3 35.3 26.8 36 24 36c-5.3 0-9.7-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.5l.1.1 6.3 5.3C39.1 37.5 44 33 44 24c0-1.2-.1-2.3-.4-3.5z"
      />
    </svg>
  );
}
