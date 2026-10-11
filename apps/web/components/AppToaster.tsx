'use client';

import { Slide, ToastContainer } from 'react-toastify';
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
      autoClose={3200}
      hideProgressBar={false}
      closeOnClick
      pauseOnHover
      draggable
      transition={Slide}
      theme={light ? 'light' : 'dark'}
      className="dracord-toast-container"
      toastClassName={(ctx) =>
        `${ctx?.defaultClassName ?? ''} dracord-toast`.trim()
      }
    />
  );
}
