import { useCallback } from "react";
import { getLocales } from "expo-localization";
import { useSettingsStore } from "@/store/settingsStore";
import {
  translations,
  TranslationKey,
  SupportedLanguage,
} from "@/i18n/translations";

export function useTranslation() {
  const languageSetting = useSettingsStore((state) => state.language);

  const t = useCallback(
    (key: TranslationKey): string => {
      let language = languageSetting;

      if (language === "system") {
        const deviceLanguage = getLocales()[0].languageCode;
        language = deviceLanguage || "en";
      }

      const lang = (
        translations[language as SupportedLanguage] ? language : "en"
      ) as SupportedLanguage;

      const translationSet = translations[lang] as Record<string, string>;
      const fallbackSet = translations.en as Record<string, string>;

      return translationSet[key] || fallbackSet[key] || key;
    },
    [languageSetting],
  );

  return { t, language: languageSetting };
}
