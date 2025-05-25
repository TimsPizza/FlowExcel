import { useMemo } from "react";
import { toast as toastify, ToastOptions } from "react-toastify";

interface IToastOptions {
  position?:
    | "top-right"
    | "top-center"
    | "top-left"
    | "bottom-right"
    | "bottom-center"
    | "bottom-left";
  autoClose?: number | false;
  hideProgressBar?: boolean;
  closeOnClick?: boolean;
  pauseOnHover?: boolean;
}

type ToastFunction = {
  success: (message: string, options?: ToastOptions) => void;
  error: (message: string, options?: ToastOptions) => void;
  info: (message: string, options?: ToastOptions) => void;
  warning: (message: string, options?: ToastOptions) => void;
};

const useToast = ({
  position = "top-right",
  autoClose = 1500,
  hideProgressBar = false,
  closeOnClick = true,
  pauseOnHover = true,
}: IToastOptions = {}): ToastFunction => {
  const toast = useMemo(() => {
    const defaultOptions: ToastOptions = {
      position,
      autoClose,
      hideProgressBar,
      closeOnClick,
      pauseOnHover,
    };

    return {
      success: (message: string, options?: ToastOptions) =>
        toastify.success(message, { ...defaultOptions, ...options }),
      error: (message: string, options?: ToastOptions) =>
        toastify.error(message, { ...defaultOptions, ...options }),
      info: (message: string, options?: ToastOptions) =>
        toastify.info(message, { ...defaultOptions, ...options }),
      warning: (message: string, options?: ToastOptions) =>
        toastify.warning(message, { ...defaultOptions, ...options }),
    };
  }, [position, autoClose, hideProgressBar, closeOnClick, pauseOnHover]);

  return toast;
};

export default useToast;
