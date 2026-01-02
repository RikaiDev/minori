/**
 * Internationalization (i18n) module for minori
 *
 * Supports multiple locales with interpolation for dynamic values.
 */

import en from './locales/en.json';
import zhTW from './locales/zh-TW.json';

export type Locale = 'en' | 'zh-TW';

export type TranslationKeys = typeof en;

type NestedKeyOf<T, K extends string = ''> = T extends object
  ? {
      [P in keyof T & string]: T[P] extends object
        ? NestedKeyOf<T[P], K extends '' ? P : `${K}.${P}`>
        : K extends ''
          ? P
          : `${K}.${P}`;
    }[keyof T & string]
  : never;

export type TranslationKey = NestedKeyOf<TranslationKeys>;

const translations: Record<Locale, TranslationKeys> = {
  en,
  'zh-TW': zhTW,
};

let currentLocale: Locale = 'zh-TW';

/**
 * Sets the current locale for translations
 */
export function setLocale(locale: Locale): void {
  currentLocale = locale;
}

/**
 * Gets the current locale
 */
export function getLocale(): Locale {
  return currentLocale;
}

/**
 * Gets available locales
 */
export function getAvailableLocales(): Locale[] {
  return Object.keys(translations) as Locale[];
}

/**
 * Gets a nested value from an object using dot notation
 */
function getNestedValue(obj: unknown, path: string): string | undefined {
  const keys = path.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return typeof current === 'string' ? current : undefined;
}

/**
 * Interpolates variables in a string
 *
 * @example
 * interpolate("Hello, {name}!", { name: "World" }) // "Hello, World!"
 */
function interpolate(
  template: string,
  variables: Record<string, string | number>
): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const value = variables[key];
    return value !== undefined ? String(value) : match;
  });
}

/**
 * Translates a key to the current locale
 *
 * @param key - The translation key in dot notation (e.g., 'record.planting.success')
 * @param variables - Optional variables for interpolation
 * @param locale - Optional locale override
 * @returns The translated string, or the key if not found
 *
 * @example
 * t('record.planting.success', { crop: 'Bok Choy', area: 2, unit: 'plots' })
 * // "✓ Recorded! Bok Choy planted on 2 plots"
 */
export function t(
  key: string,
  variables?: Record<string, string | number>,
  locale?: Locale
): string {
  const targetLocale = locale ?? currentLocale;
  const translation = getNestedValue(translations[targetLocale], key);

  if (!translation) {
    // Fallback to English if key not found in current locale
    const fallback = getNestedValue(translations.en, key);
    if (!fallback) {
      console.warn(`[i18n] Missing translation for key: ${key}`);
      return key;
    }
    return variables ? interpolate(fallback, variables) : fallback;
  }

  return variables ? interpolate(translation, variables) : translation;
}

/**
 * Creates a translator function bound to a specific locale
 *
 * @param locale - The locale to bind to
 * @returns A translation function for the specified locale
 */
export function createTranslator(locale: Locale) {
  return (key: string, variables?: Record<string, string | number>): string => {
    return t(key, variables, locale);
  };
}

export default {
  t,
  setLocale,
  getLocale,
  getAvailableLocales,
  createTranslator,
};
