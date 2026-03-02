import { ExtendedKind } from '@/constants'
import { getPollMetadataFromEvent } from '@/lib/event-metadata'
import libreTranslate from '@/services/libre-translate.service'
import openrouterTranslate from '@/services/openrouter-translate.service'
import storage from '@/services/local-storage.service'
import translation from '@/services/translation.service'
import indexedDb from '@/services/indexed-db.service'
import { TTranslationAccount, TTranslationServiceConfig } from '@/types'
import { Event, kinds } from 'nostr-tools'
import { createContext, useContext, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNostr } from './NostrProvider'

const translatedEventCache: Map<string, Event> = new Map()
const translatedTextCache: Map<string, string> = new Map()
let cacheInitialized = false

type TTranslationServiceContext = {
  config: TTranslationServiceConfig
  translatedEventIdSet: Set<string>
  translateText: (text: string) => Promise<string>
  translateEvent: (event: Event) => Promise<Event | void>
  autoTranslateEvent: (event: Event) => Promise<Event | void>
  getTranslatedEvent: (eventId: string) => Event | null
  showOriginalEvent: (eventId: string) => void
  getAccount: () => Promise<TTranslationAccount | void>
  regenerateApiKey: () => Promise<string | undefined>
  updateConfig: (newConfig: TTranslationServiceConfig) => void
  shouldAutoTranslate: () => boolean
}

const TranslationServiceContext = createContext<TTranslationServiceContext | undefined>(undefined)

export const useTranslationService = () => {
  const context = useContext(TranslationServiceContext)
  if (!context) {
    throw new Error('useTranslation must be used within a TranslationProvider')
  }
  return context
}

export function TranslationServiceProvider({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation()
  const [config, setConfig] = useState<TTranslationServiceConfig>({ service: 'jumble' })
  const { pubkey, startLogin } = useNostr()
  const [translatedEventIdSet, setTranslatedEventIdSet] = useState<Set<string>>(new Set())

  // Initialize cache from IndexedDB on mount
  useEffect(() => {
    if (!cacheInitialized) {
      cacheInitialized = true
      indexedDb.getAllTranslatedEvents().then((events) => {
        events.forEach((event, key) => {
          translatedEventCache.set(key, event)
        })
        // Update the translated event ID set
        const eventIds = new Set<string>()
        events.forEach((_, key) => {
          const eventId = key.split('_')[1] // Extract eventId from "lang_eventId" format
          if (eventId) {
            eventIds.add(eventId)
          }
        })
        setTranslatedEventIdSet(eventIds)
      }).catch((error) => {
        console.error('Failed to load translated events from IndexedDB:', error)
      })

      // Clean up old translations (older than 30 days)
      indexedDb.clearOldTranslatedEvents().catch((error) => {
        console.error('Failed to clear old translations:', error)
      })
    }
  }, [])

  useEffect(() => {
    translation.changeCurrentPubkey(pubkey)
    const config = storage.getTranslationServiceConfig(pubkey)
    setConfig(config)
  }, [pubkey])

  const getAccount = async (): Promise<TTranslationAccount | void> => {
    if (config.service !== 'jumble') return
    if (!pubkey) {
      startLogin()
      return
    }
    return await translation.getAccount()
  }

  const regenerateApiKey = async (): Promise<string | undefined> => {
    if (config.service !== 'jumble') return
    if (!pubkey) {
      startLogin()
      return
    }
    return await translation.regenerateApiKey()
  }

  const getTranslatedEvent = (eventId: string): Event | null => {
    const target = i18n.language
    const cacheKey = target + '_' + eventId
    return translatedEventCache.get(cacheKey) ?? null
  }

  const translate = async (text: string, target: string): Promise<string> => {
    if (config.service === 'jumble') {
      return await translation.translate(text, target)
    } else if (config.service === 'libre_translate') {
      return await libreTranslate.translate(text, target, config.server, config.api_key)
    } else if (config.service === 'openrouter') {
      // Use API key from config first, fall back to AI tools config
      const aiServiceConfig = storage.getAIServiceConfig(pubkey)
      const apiKey = config.api_key || aiServiceConfig.apiKey
      const model = config.model || aiServiceConfig.model || 'google/gemini-2.0-flash-001'
      return await openrouterTranslate.translate(text, target, apiKey, model)
    }
    throw new Error('Invalid translation service')
  }

  const translateText = async (text: string): Promise<string> => {
    if (!text) {
      return text
    }

    const target = i18n.language
    const cacheKey = target + '_' + text
    const cache = translatedTextCache.get(cacheKey)
    if (cache) {
      return cache
    }

    const translatedText = await translate(text, target)
    translatedTextCache.set(cacheKey, translatedText)
    return translatedText
  }

  const translateHighlightEvent = async (event: Event): Promise<Event> => {
    const target = i18n.language
    const comment = event.tags.find((tag) => tag[0] === 'comment')?.[1]

    const texts = {
      content: event.content,
      comment
    }
    const joinedText = joinTexts(texts)
    if (!joinedText) return event

    const translatedText = await translate(joinedText, target)
    const translatedTexts = splitTranslatedText(translatedText)
    return {
      ...event,
      content: translatedTexts.content ?? event.content,
      tags: event.tags.map((tag) =>
        tag[0] === 'comment' ? ['comment', translatedTexts.comment ?? tag[1]] : tag
      )
    }
  }

  const translatePollEvent = async (event: Event): Promise<Event> => {
    const target = i18n.language
    const pollMetadata = getPollMetadataFromEvent(event)

    const texts: Record<string, string> = {
      question: event.content,
      ...pollMetadata?.options.reduce(
        (acc, option) => {
          acc[option.id] = option.label
          return acc
        },
        {} as Record<string, string>
      )
    }
    const joinedText = joinTexts(texts)
    if (!joinedText) return event

    const translatedText = await translate(joinedText, target)
    const translatedTexts = splitTranslatedText(translatedText)
    return {
      ...event,
      content: translatedTexts.question ?? '',
      tags: event.tags.map((tag) =>
        tag[0] === 'option' ? ['option', tag[1], translatedTexts[tag[1]] ?? tag[2]] : tag
      )
    }
  }

  const translateEvent = async (event: Event): Promise<Event | void> => {
    if (config.service === 'jumble' && !pubkey) {
      startLogin()
      return
    }

    const target = i18n.language
    const cacheKey = target + '_' + event.id
    const cache = translatedEventCache.get(cacheKey)
    if (cache) {
      setTranslatedEventIdSet((prev) => new Set(prev.add(event.id)))
      return cache
    }

    let translatedEvent: Event | undefined
    if (event.kind === kinds.Highlights) {
      translatedEvent = await translateHighlightEvent(event)
    } else if (event.kind === ExtendedKind.POLL) {
      translatedEvent = await translatePollEvent(event)
    } else {
      const translatedText = await translate(event.content, target)
      if (!translatedText) {
        return
      }
      translatedEvent = { ...event, content: translatedText }
    }

    translatedEventCache.set(cacheKey, translatedEvent)
    setTranslatedEventIdSet((prev) => new Set(prev.add(event.id)))

    // Save to IndexedDB for persistence
    indexedDb.putTranslatedEvent(event.id, target, translatedEvent).catch((error) => {
      console.error('Failed to save translation to IndexedDB:', error)
    })

    return translatedEvent
  }

  const showOriginalEvent = (eventId: string) => {
    setTranslatedEventIdSet((prev) => {
      const newSet = new Set(prev)
      newSet.delete(eventId)
      return newSet
    })
  }

  const shouldAutoTranslate = () => {
    if (config.service === 'jumble') {
      return config.auto_translate ?? false
    } else if (config.service === 'libre_translate') {
      return config.auto_translate ?? false
    } else if (config.service === 'openrouter') {
      return config.auto_translate ?? false
    }
    return false
  }

  const autoTranslateEvent = async (event: Event): Promise<Event | void> => {
    if (!shouldAutoTranslate()) {
      return
    }

    // Check if already translated
    const target = i18n.language
    const cacheKey = target + '_' + event.id
    if (translatedEventCache.has(cacheKey) || translatedEventIdSet.has(event.id)) {
      return
    }

    // Silently translate in background
    try {
      await translateEvent(event)
    } catch (error) {
      // Silently fail for auto-translation
      console.debug('Auto-translation failed:', error)
    }
  }

  const updateConfig = (newConfig: TTranslationServiceConfig) => {
    setConfig(newConfig)
    storage.setTranslationServiceConfig(newConfig, pubkey)
  }

  return (
    <TranslationServiceContext.Provider
      value={{
        config,
        translatedEventIdSet,
        getAccount,
        regenerateApiKey,
        translateText,
        translateEvent,
        autoTranslateEvent,
        getTranslatedEvent,
        showOriginalEvent,
        updateConfig,
        shouldAutoTranslate
      }}
    >
      {children}
    </TranslationServiceContext.Provider>
  )
}

function joinTexts(texts: Record<string, string | undefined>): string {
  return (
    Object.entries(texts).filter(([, content]) => content && content.trim() !== '') as [
      string,
      string
    ][]
  )
    .map(([key, content]) => `=== ${key} ===\n${content.trim()}\n=== ${key} ===`)
    .join('\n\n')
}

function splitTranslatedText(translated: string) {
  const regex = /=== (.+?) ===\n([\s\S]*?)\n=== \1 ===/g
  const results: Record<string, string | undefined> = {}

  let match: RegExpExecArray | null
  while ((match = regex.exec(translated)) !== null) {
    const key = match[1].trim()
    const content = match[2].trim()
    results[key] = content
  }

  return results
}
