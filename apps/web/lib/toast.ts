import { toast as rtToast, type ToastOptions } from 'react-toastify';

const base: ToastOptions = {
  position: 'bottom-right',
  autoClose: 3200,
  hideProgressBar: false,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,
  theme: 'colored',
};

export const toast = {
  success: (msg: string, opts?: ToastOptions) =>
    rtToast.success(msg, { ...base, ...opts }),
  error: (msg: string, opts?: ToastOptions) =>
    rtToast.error(msg, { ...base, ...opts }),
  info: (msg: string, opts?: ToastOptions) =>
    rtToast.info(msg, { ...base, ...opts }),
  warn: (msg: string, opts?: ToastOptions) =>
    rtToast.warn(msg, { ...base, ...opts }),
};
