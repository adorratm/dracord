import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import { LoginPage } from './pages/LoginPage';
import { Shell } from './pages/Shell';
import { OAuthCallbackPage } from './pages/OAuthCallbackPage';
import { OnboardingUsername } from './pages/OnboardingUsername';
import { VoiceSessionProvider } from './voice/VoiceSession';

export function App() {
  const { user, ready, refreshUser } = useAuth();
  if (!ready) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '100%' }}>
        Yükleniyor…
      </div>
    );
  }

  const needsUsername = Boolean(user && user.usernameConfirmed === false);

  return (
    <Routes>
      <Route path="/auth/callback" element={<OAuthCallbackPage />} />
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route
        path="/*"
        element={
          !user ? (
            <Navigate to="/login" replace />
          ) : needsUsername ? (
            <OnboardingUsername
              onDone={() => {
                void refreshUser();
              }}
            />
          ) : (
            <VoiceSessionProvider>
              <Shell />
            </VoiceSessionProvider>
          )
        }
      />
    </Routes>
  );
}
