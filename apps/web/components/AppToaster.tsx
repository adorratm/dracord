'use client';

import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useUserPreferences } from '@/lib/user-preferences';

export function AppToaster() {
  const { prefs } = useUserPreferences();
  const light = prefs.appearance.theme === 'light';

  return (
    <ToastContainer
      position="bottom-right"
      newestOnTop
      limit={4}
      theme={light ? 'light' : 'dark'}
      toastClassName={() =>
        light
          ? 'relative flex p-3 min-h-12 rounded-xl justify-between overflow-hidden cursor-pointer bg-[var(--md-sys-color-surface-container-high,#eceff4)] text-[var(--md-sys-color-on-surface,#1e1e2e)] border border-[color-mix(in_srgb,var(--md-sys-color-outline,#6272a4)_35%,transparent)] shadow-lg font-[inherit] text-sm'
          : 'relative flex p-3 min-h-12 rounded-xl justify-between overflow-hidden cursor-pointer bg-[#282a36] text-[#f8f8f2] border border-[#44475a] shadow-lg font-[inherit] text-sm'
      }
      progressClassName={() =>
        light
          ? 'Toastify__progress-bar Toastify__progress-bar--wrp bg-[var(--md-sys-color-primary,#7c3aed)]'
          : 'Toastify__progress-bar Toastify__progress-bar--wrp bg-[#bd93f9]'
      }
    />
  );
}
