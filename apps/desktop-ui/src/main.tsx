import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { AuthProvider } from './auth';
import { App } from './App';
import { API_URL } from './config';
import { loadLocalPrefs, syncDesktopSystemPrefs } from './lib/client-settings';
import './styles.css';

(window as Window & { __DRACORD_API_URL__?: string }).__DRACORD_API_URL__ = API_URL;

// UI’daki “başlangıçta aç” tercihini OS’e bağla (önceki sürümlerde sadece localStorage’daydı)
try {
  syncDesktopSystemPrefs(loadLocalPrefs().system);
} catch {
  /* ignore */
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </HashRouter>
  </StrictMode>,
);
