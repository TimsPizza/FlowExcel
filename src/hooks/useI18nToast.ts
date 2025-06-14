import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { toast as toastify, ToastOptions } from "react-toastify";

interface II18nToastOptions {
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

type I18nToastFunction = {
  success: (key: string, values?: Record<string, any>, options?: ToastOptions) => void;
  error: (key: string, values?: Record<string, any>, options?: ToastOptions) => void;
  info: (key: string, values?: Record<string, any>, options?: ToastOptions) => void;
  warning: (key: string, values?: Record<string, any>, options?: ToastOptions) => void;
  // 直接显示文本（用于后端返回的已翻译消息）
  showText: {
    success: (message: string, options?: ToastOptions) => void;
    error: (message: string, options?: ToastOptions) => void;
    info: (message: string, options?: ToastOptions) => void;
    warning: (message: string, options?: ToastOptions) => void;
  };
};

const useI18nToast = ({
  position = "top-center",
  autoClose = 1500,
  hideProgressBar = false,
  closeOnClick = true,
  pauseOnHover = true,
}: II18nToastOptions = {}): I18nToastFunction => {
  const { t } = useTranslation();

  const toast = useMemo(() => {
    const defaultOptions: ToastOptions = {
      position,
      autoClose,
      hideProgressBar,
      closeOnClick,
      pauseOnHover,
    };

    return {
      success: (key: string, values?: Record<string, any>, options?: ToastOptions) =>
        toastify.success(t(key, values), { ...defaultOptions, ...options }),
      error: (key: string, values?: Record<string, any>, options?: ToastOptions) =>
        toastify.error(t(key, values), { ...defaultOptions, ...options }),
      info: (key: string, values?: Record<string, any>, options?: ToastOptions) =>
        toastify.info(t(key, values), { ...defaultOptions, ...options }),
      warning: (key: string, values?: Record<string, any>, options?: ToastOptions) =>
        toastify.warning(t(key, values), { ...defaultOptions, ...options }),
      
      // 直接显示文本的方法
      showText: {
        success: (message: string, options?: ToastOptions) =>
          toastify.success(message, { ...defaultOptions, ...options }),
        error: (message: string, options?: ToastOptions) =>
          toastify.error(message, { ...defaultOptions, ...options }),
        info: (message: string, options?: ToastOptions) =>
          toastify.info(message, { ...defaultOptions, ...options }),
        warning: (message: string, options?: ToastOptions) =>
          toastify.warning(message, { ...defaultOptions, ...options }),
      }
    };
  }, [t, position, autoClose, hideProgressBar, closeOnClick, pauseOnHover]);

  return toast;
};

export default useI18nToast; 