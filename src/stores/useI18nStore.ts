import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface I18nState {
  language: string;
}
interface I18nActions {
  setLanguage: (language: string) => void;
  getLanguage: () => string;
}
interface I18nStore extends I18nState, I18nActions {}

export const useI18nStore = create<I18nStore>()(
  persist(
    (set, get) => ({
      language: "en",
      setLanguage: (language) => set({ language }),
      getLanguage: () => get().language,
    }),
    {
      name: "flowexcel-i18n",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
