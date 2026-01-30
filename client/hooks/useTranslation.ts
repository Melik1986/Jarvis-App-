import { useCallback } from "react";
import { useSettingsStore } from "@/store/settingsStore";
import {
  translations,
  TranslationKey,
  SupportedLanguage,
} from "@/i18n/translations";

export function useTranslation() {
  const language = useSettingsStore(
    (state) => state.language,
  ) as SupportedLanguage;

  const t = useCallback(
    (key: TranslationKey): string => {
      const lang = translations[language] ? language : "en";
      return translations[lang][key] || translations.en[key] || key;
    },
    [language],
  );

  return { t, language };
}
