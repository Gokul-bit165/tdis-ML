import { toast, Slide } from 'react-toastify';

export const errorToast = (message, toastId = '') => {
  toast.error(message, {
    toastId: toastId,
    position: 'top-right',
    autoClose: 3000,
    hideProgressBar: false,
    newestOnTop: true,
    closeOnClick: true,
    pauseOnHover: true,
    transition: Slide,
  });
};

export const successToast = (message, toastId = '') => {
  toast.success(message, {
    toastId: toastId,
    position: 'top-right',
    autoClose: 3000,
    hideProgressBar: false,
    newestOnTop: true,
    closeOnClick: true,
    pauseOnHover: true,
    transition: Slide,
  });
};
