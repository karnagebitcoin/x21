import dayjs from 'dayjs'
import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
// Only import English as the default/fallback language
import en from './locales/en'
import { collectMissingKeys, mergeWithFallback } from './utils'

// Language metadata without loading the actual resources
const languages = {
  ar: { name: 'العربية' },
  de: { name: 'Deutsch' },
  en: { name: 'English' },
  es: { name: 'Español' },
  fa: { name: 'فارسی' },
  fr: { name: 'Français' },
  hi: { name: 'हिन्दी' },
  it: { name: 'Italiano' },
  ja: { name: '日本語' },
  ko: { name: '한국어' },
  pl: { name: 'Polski' },
  'pt-BR': { name: 'Português (Brasil)' },
  'pt-PT': { name: 'Português (Portugal)' },
  ru: { name: 'Русский' },
  th: { name: 'ไทย' },
  zh: { name: '简体中文' }
} as const

export type TLanguage = keyof typeof languages

// RTL languages list
export const RTL_LANGUAGES: TLanguage[] = ['ar', 'fa']

export const isRTLLanguage = (language: TLanguage): boolean => {
  return RTL_LANGUAGES.includes(language)
}

export const LocalizedLanguageNames: { [key in TLanguage]?: string } = {}
const supportedLanguages: TLanguage[] = []
for (const [key, value] of Object.entries(languages)) {
  const lang = key as TLanguage
  LocalizedLanguageNames[lang] = value.name
  supportedLanguages.push(lang)
}

// Lazy load language resources
type TLocaleModule = {
  default: {
    translation?: Record<string, unknown>
  } & Record<string, unknown>
}

const languageLoaders: Record<TLanguage, () => Promise<TLocaleModule>> = {
  ar: () => import('./locales/ar'),
  de: () => import('./locales/de'),
  en: () => Promise.resolve({ default: en }),
  es: () => import('./locales/es'),
  fa: () => import('./locales/fa'),
  fr: () => import('./locales/fr'),
  hi: () => import('./locales/hi'),
  it: () => import('./locales/it'),
  ja: () => import('./locales/ja'),
  ko: () => import('./locales/ko'),
  pl: () => import('./locales/pl'),
  'pt-BR': () => import('./locales/pt-BR'),
  'pt-PT': () => import('./locales/pt-PT'),
  ru: () => import('./locales/ru'),
  th: () => import('./locales/th'),
  zh: () => import('./locales/zh')
}

// Track loaded languages to avoid duplicate loads
const loadedLanguages = new Set<TLanguage>(['en'])

// Function to load a language on demand
export async function loadLanguage(lang: TLanguage): Promise<void> {
  if (loadedLanguages.has(lang)) return

  try {
    const loader = languageLoaders[lang]
    if (loader) {
      const module = await loader()
      const loadedTranslation = (module.default.translation ?? module.default) as Record<
        string,
        unknown
      >
      const fallbackTranslation = en.translation as Record<string, unknown>
      const mergedTranslation = mergeWithFallback(fallbackTranslation, loadedTranslation)

      i18n.addResourceBundle(lang, 'translation', mergedTranslation, true, true)
      loadedLanguages.add(lang)

      if (import.meta.env.DEV) {
        const missingKeys = collectMissingKeys(fallbackTranslation, loadedTranslation)
        if (missingKeys.length > 0) {
          const preview = missingKeys.slice(0, 5).join(', ')
          console.info(
            `[i18n] ${lang}: ${missingKeys.length} missing keys (fallback=en). Sample: ${preview}`
          )
        }
      }
    }
  } catch (error) {
    console.error(`Failed to load language: ${lang}`, error)
  }
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    resources: {
      en: en
    },
    returnNull: false,
    returnEmptyString: false,
    saveMissing: import.meta.env.DEV,
    missingKeyHandler: (lngs, _ns, key) => {
      if (!import.meta.env.DEV) return
      const langs = Array.isArray(lngs) ? lngs.join(',') : lngs
      console.warn(`[i18n] missing key "${key}" for ${langs} (fallback=en)`)
    },
    interpolation: {
      escapeValue: false // react already safes from xss
    },
    detection: {
      convertDetectedLanguage: (lng) => {
        const supported = supportedLanguages.find((supported) => lng.startsWith(supported))
        return supported || 'en'
      }
    }
  })

// Load the detected language if it's not English
const detectedLang = i18n.language as TLanguage
if (detectedLang && detectedLang !== 'en' && supportedLanguages.includes(detectedLang)) {
  loadLanguage(detectedLang)
}

// Listen for language changes and load the new language
i18n.on('languageChanged', (lng: string) => {
  const lang = lng as TLanguage
  if (supportedLanguages.includes(lang)) {
    loadLanguage(lang)
  }
})

i18n.services.formatter?.add('date', (timestamp, lng) => {
  switch (lng) {
    case 'zh':
    case 'ja':
      return dayjs(timestamp).format('YYYY年MM月DD日')
    case 'pl':
    case 'de':
    case 'ru':
      return dayjs(timestamp).format('DD.MM.YYYY')
    case 'fa':
      return dayjs(timestamp).format('YYYY/MM/DD')
    case 'it':
    case 'es':
    case 'fr':
    case 'pt-BR':
    case 'pt-PT':
    case 'ar':
    case 'hi':
    case 'th':
      return dayjs(timestamp).format('DD/MM/YYYY')
    case 'ko':
      return dayjs(timestamp).format('YYYY년 MM월 DD일')
    default:
      return dayjs(timestamp).format('MMM D, YYYY')
  }
})

export default i18n
