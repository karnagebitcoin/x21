import { useTranslationService } from '@/providers/TranslationServiceProvider'
import { detectLanguage } from '@/lib/utils'
import { Event } from 'nostr-tools'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

// Language code to full name mapping
const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  pt: 'Portuguese',
  ru: 'Russian',
  ja: 'Japanese',
  ko: 'Korean',
  zh: 'Chinese',
  ar: 'Arabic',
  hi: 'Hindi',
  nl: 'Dutch',
  pl: 'Polish',
  tr: 'Turkish',
  vi: 'Vietnamese',
  th: 'Thai',
  sv: 'Swedish',
  da: 'Danish',
  fi: 'Finnish',
  no: 'Norwegian',
  cs: 'Czech',
  el: 'Greek',
  he: 'Hebrew',
  id: 'Indonesian',
  uk: 'Ukrainian',
  ro: 'Romanian',
  hu: 'Hungarian',
  sk: 'Slovak',
  bg: 'Bulgarian',
  hr: 'Croatian',
  sr: 'Serbian',
  sl: 'Slovenian',
  lt: 'Lithuanian',
  lv: 'Latvian',
  et: 'Estonian',
  fa: 'Persian',
  ur: 'Urdu',
  bn: 'Bengali',
  ta: 'Tamil',
  te: 'Telugu',
  ml: 'Malayalam',
  kn: 'Kannada',
  mr: 'Marathi',
  gu: 'Gujarati',
  pa: 'Punjabi',
  und: 'Unknown'
}

export default function TranslationIndicator({
  event,
  className
}: {
  event: Event
  className?: string
}) {
  const { t } = useTranslation()
  const { showOriginalEvent, translatedEventIdSet } = useTranslationService()
  
  const isTranslated = useMemo(() => {
    return translatedEventIdSet.has(event.id)
  }, [event.id, translatedEventIdSet])

  const detectedLanguage = useMemo(() => {
    const langCode = detectLanguage(event.content)
    return langCode ? LANGUAGE_NAMES[langCode] || langCode : 'Unknown'
  }, [event.content])

  if (!isTranslated) {
    return null
  }

  return (
    <div className={className}>
      <p className="text-xs text-muted-foreground">
        Translated from {detectedLanguage}.{' '}
        <button
          onClick={(e) => {
            e.stopPropagation()
            showOriginalEvent(event.id)
          }}
          className="text-primary hover:underline"
        >
          Show original
        </button>
      </p>
    </div>
  )
}
