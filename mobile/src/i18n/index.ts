import AsyncStorage from "@react-native-async-storage/async-storage";
import { getLocales } from "expo-localization";
// `use` is imported under another name deliberately: called as `use(...)` ESLint's rules-of-hooks
// reads it as React's `use` hook being called outside a component, and errors.
import i18next, { changeLanguage, use as registerPlugin } from "i18next";
import { initReactI18next } from "react-i18next";

import bn from "./locales/bn.json";
import en from "./locales/en.json";
import ms from "./locales/ms.json";

export const SUPPORTED_LANGUAGES = ["en", "bn", "ms"] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_STORAGE_KEY = "settings.language";

// English is the resource every other locale falls back to key-by-key, so a string that has not
// been translated yet renders in English rather than as a raw key like "connection.checkAgain".
const resources = {
  en: { translation: en },
  bn: { translation: bn },
  ms: { translation: ms },
};

function isSupported(language: string | undefined | null): language is Language {
  return SUPPORTED_LANGUAGES.includes(language as Language);
}

/**
 * A stored choice always wins over the device locale — otherwise someone who deliberately
 * switched the app to Bangla on an English phone would be silently reset to English on the next
 * launch, which reads as the setting not working at all.
 */
export async function resolveInitialLanguage(): Promise<Language> {
  try {
    const stored = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (isSupported(stored)) return stored;
  } catch {
    // A failed read is not worth blocking startup over: fall through to the device locale.
  }

  // languageCode is the bare language ("bn"), not the full tag ("bn-BD") — matching on the tag
  // would miss every regional variant.
  const deviceLanguage = getLocales()[0]?.languageCode;
  return isSupported(deviceLanguage) ? deviceLanguage : "en";
}

export async function setLanguage(language: Language): Promise<void> {
  await changeLanguage(language);
  try {
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // The language has already changed for this session; failing to persist it is not worth
    // surfacing to the user or undoing the change over.
  }
}

/**
 * Must be awaited before the first render that reads a translation, which is why the root layout
 * holds the splash screen until it resolves: i18next returns the key itself when asked for a
 * string before initialization, so rendering early would flash "connection.checkAgain" on screen.
 */
export async function initI18n(): Promise<typeof i18next> {
  if (i18next.isInitialized) return i18next;

  await registerPlugin(initReactI18next).init({
    resources,
    lng: await resolveInitialLanguage(),
    fallbackLng: "en",
    // React escapes everything it renders already; leaving i18next's own escaping on would
    // double-encode any apostrophe or ampersand that appears in a translated string.
    interpolation: { escapeValue: false },
  });

  return i18next;
}

export default i18next;
