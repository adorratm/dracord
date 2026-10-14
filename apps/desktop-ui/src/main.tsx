import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { AuthProvider } from './auth';
import { App } from './App';
import { API_URL } from './config';
import './styles.css';

(window as Window & { __DRACORD_API_URL__?: string }).__DRACORD_API_URL__ = API_URL;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </HashRouter>
  </StrictMode>,
);
