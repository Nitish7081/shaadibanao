/** Pure (no React Native imports) so it can be unit-tested. */
export const DEFAULT_LANGUAGE = 'en';

export interface LanguageOption {
  code: string;
  native: string;
  label: string;
}

export const PRIMARY_LANGUAGES: LanguageOption[] = [
  { code: 'hi', native: 'हिन्दी', label: 'Hindi' },
  { code: 'en', native: 'English', label: 'English' },
];

export const OTHER_LANGUAGES: LanguageOption[] = [
  { code: 'mr', native: 'मराठी', label: 'Marathi' },
  { code: 'gu', native: 'ગુજરાતી', label: 'Gujarati' },
  { code: 'pa', native: 'ਪੰਜਾਬੀ', label: 'Punjabi' },
  { code: 'bn', native: 'বাংলা', label: 'Bengali' },
  { code: 'ta', native: 'தமிழ்', label: 'Tamil' },
  { code: 'te', native: 'తెలుగు', label: 'Telugu' },
  { code: 'kn', native: 'ಕನ್ನಡ', label: 'Kannada' },
];

const ALL = [...PRIMARY_LANGUAGES, ...OTHER_LANGUAGES];

export function isSupportedLanguage(code: unknown): code is string {
  return typeof code === 'string' && ALL.some((l) => l.code === code);
}

export function languageLabel(code: string): string {
  const found = ALL.find((l) => l.code === code);
  return found ? found.native : 'English';
}
