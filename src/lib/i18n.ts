import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import en from "@/locales/en.json";
import zh from "@/locales/zh.json";
import { useI18nStore } from "@/stores/useI18nStore";

const resources = {
  en: {
    translation: en,
  },
  zh: {
    translation: zh,
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    lng: useI18nStore.getState().getLanguage(),
    fallbackLng: "en",

    keySeparator: ".",
    interpolation: {
      escapeValue: false,
    },

    detection: {
      order: ["localStorage", "navigator", "htmlTag"],
      caches: ["localStorage"],
      lookupLocalStorage: "i18nextLng",
    },
  });

export default i18n;

// 语言切换工具函数
export const changeLanguage = (lng: string) => {
  i18n.changeLanguage(lng);
  useI18nStore.getState().setLanguage(lng);
};

export const getCurrentLanguage = () => {
  return useI18nStore.getState().getLanguage();
};

export const languageOptions = [
  { code: "zh", name: "中文", nativeName: "中文" },
  { code: "en", name: "English", nativeName: "English" },
];
