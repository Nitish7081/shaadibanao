import { en } from '../../apps/mobile/src/i18n/locales/en';
import { hi } from '../../apps/mobile/src/i18n/locales/hi';
import { PRIMARY_LANGUAGES, OTHER_LANGUAGES, isSupportedLanguage } from '../../apps/mobile/src/i18n/languages';

describe('i18n Locales & Language Configuration', () => {
  function getAllKeys(obj: Record<string, any>, prefix = ''): { key: string; value: string }[] {
    const res: { key: string; value: string }[] = [];
    for (const [k, v] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${k}` : k;
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        res.push(...getAllKeys(v, fullKey));
      } else if (typeof v === 'string') {
        res.push({ key: fullKey, value: v });
      }
    }
    return res;
  }

  const enEntries = getAllKeys(en);
  const hiEntries = getAllKeys(hi);
  const enKeySet = new Set(enEntries.map((e) => e.key));
  const hiKeyMap = new Map(hiEntries.map((e) => [e.key, e.value]));

  it('has non-empty values for all English translation keys', () => {
    expect(enEntries.length).toBeGreaterThan(30);
    enEntries.forEach(({ key, value }) => {
      expect(value.trim().length).toBeGreaterThan(0);
    });
  });

  it('provides complete Hindi translations for EVERY English key (no missing keys)', () => {
    const missingInHi: string[] = [];
    enKeySet.forEach((key) => {
      const hiVal = hiKeyMap.get(key);
      if (!hiVal || typeof hiVal !== 'string' || !hiVal.trim()) {
        missingInHi.push(key);
      }
    });
    expect(missingInHi).toEqual([]);
  });

  it('preserves all interpolation placeholders (e.g. {{name}}, {{count}}) in Hindi', () => {
    const placeholderRegex = /\{\{\s*(\w+)\s*\}\}/g;
    enEntries.forEach(({ key, value: enVal }) => {
      const enMatches = Array.from(enVal.matchAll(placeholderRegex), (m) => m[1]).sort();
      if (enMatches.length > 0) {
        const hiVal = hiKeyMap.get(key) || '';
        const hiMatches = Array.from(hiVal.matchAll(placeholderRegex), (m) => m[1]).sort();
        expect({ key, placeholders: hiMatches }).toEqual({ key, placeholders: enMatches });
      }
    });
  });

  it('configures primary languages (Hindi & English) and other Indian languages', () => {
    expect(PRIMARY_LANGUAGES.map((l) => l.code)).toEqual(['hi', 'en']);
    const otherCodes = OTHER_LANGUAGES.map((l) => l.code);
    expect(otherCodes).toEqual(['mr', 'gu', 'pa', 'bn', 'ta', 'te', 'kn']);

    expect(isSupportedLanguage('hi')).toBe(true);
    expect(isSupportedLanguage('en')).toBe(true);
    expect(isSupportedLanguage('mr')).toBe(true);
    expect(isSupportedLanguage('kn')).toBe(true);
    expect(isSupportedLanguage('invalid_lang')).toBe(false);
    expect(isSupportedLanguage(null)).toBe(false);
  });
});
