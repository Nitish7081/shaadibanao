import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { en } from './locales/en';
import { hi } from './locales/hi';
import { others } from './locales/others';
import { isSupportedLanguage, DEFAULT_LANGUAGE } from './languages';

export const LANGUAGE_STORAGE_KEY = 'app.language';

const resources: Record<string, { translation: any }> = {
  en: { translation: en },
  hi: { translation: hi },
};
Object.keys(others).forEach((code) => {
  resources[code] = { translation: others[code] };
});

let initialised = false;
let languageChosen = false;

/** Call once before rendering. Restores the saved language (or English). */
export async function initI18n(): Promise<void> {
  let saved: string | null = null;
  try {
    saved = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
  } catch {
    saved = null;
  }
  languageChosen = isSupportedLanguage(saved);
  if (!initialised) {
    await i18n.use(initReactI18next).init({
      resources,
      lng: isSupportedLanguage(saved) ? saved : DEFAULT_LANGUAGE,
      fallbackLng: 'en',
      returnNull: false,
      returnEmptyString: false,
      compatibilityJSON: 'v4',
      interpolation: { escapeValue: false },
      react: { useSuspense: false },
    });
    initialised = true;
  } else if (isSupportedLanguage(saved)) {
    await i18n.changeLanguage(saved);
  }
}

/** Apply a language immediately and remember it for the next app start. */
export async function setAppLanguage(code: string): Promise<void> {
  const next = isSupportedLanguage(code) ? code : DEFAULT_LANGUAGE;
  await i18n.changeLanguage(next);
  languageChosen = true;
  try {
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, next);
  } catch {
    // Language is still applied for this session even if saving fails.
  }
}

export function hasChosenLanguage(): boolean {
  return languageChosen;
}

export default i18n;
