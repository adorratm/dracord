import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { AuthProvider } from './auth';
import { App } from './App';
import { API_URL } from './config';
import { installBrowserErrorReporter } from '@dracord/sdk';
import { applyPrefsDom, loadLocalPrefs, syncDesktopSystemPrefs } from './lib/client-settings';
import './styles.css';

(window as Window & { __DRACORD_API_URL__?: string }).__DRACORD_API_URL__ = API_URL;

// Yakalanmamış hatalar → Yönetim › İstemci hataları (sürüm gelince kurulur)
{
  const install = (version?: string) =>
    installBrowserErrorReporter({ apiUrl: API_URL, platform: 'desktop', version, disabled: import.meta.env.DEV });
  const v = window.dracordDesktop?.getAppVersion?.();
  if (v) void v.then((x) => install(String(x ?? ''))).catch(() => install());
  else install();
}

// UI’daki “başlangıçta aç” tercihini OS’e bağla (önceki sürümlerde sadece localStorage’daydı)
try {
  const prefs = loadLocalPrefs();
  applyPrefsDom(prefs);
  syncDesktopSystemPrefs(prefs.system);
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
