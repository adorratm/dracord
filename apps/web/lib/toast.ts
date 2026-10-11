import { Slide, toast as rtToast, type ToastOptions } from 'react-toastify';

/** Container theme sağlar; Slide her çağrıda da uygulanır (güncel toastify davranışı) */
const base: ToastOptions = {
  position: 'bottom-right',
  autoClose: 3200,
  hideProgressBar: false,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,
  transition: Slide,
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
