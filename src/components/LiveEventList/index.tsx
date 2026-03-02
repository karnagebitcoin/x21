import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Event as NostrEvent } from 'nostr-tools'
import { BIG_RELAY_URLS } from '@/constants'
import client from '@/services/client.service'
import LiveEventCard from '@/components/LiveEventCard'
import { LiveEventCardSkeleton } from '@/components/LiveEventCard'

export type TLiveEventListRef = {
  refresh: () => void
}

const LIVE_STREAM_RELAYS = Array.from(new Set([
  ...BIG_RELAY_URLS,
  'wss://relay.snort.social/',
  'wss://relay.primal.net/',
  'wss://nostr.wine/'
]))

function getTagValue(event: NostrEvent, tagName: string): string | undefined {
  return event.tags.find((tag) => tag[0] === tagName)?.[1]
}

function parseUnix(value?: string): number | null {
  if (!value) return null
  const normalized = value.trim()
  const parsed = Number(normalized)
  if (Number.isFinite(parsed)) {
    // Some clients publish unix timestamps in milliseconds.
    if (parsed > 1e10) return Math.floor(parsed / 1000)
    return Math.floor(parsed)
  }

  const dateMs = Date.parse(normalized)
  if (!Number.isNaN(dateMs)) return Math.floor(dateMs / 1000)

  return null
}

function isActiveLiveStream(event: NostrEvent, now: number): boolean {
  const status = getTagValue(event, 'status')?.trim().toLowerCase()
  if (status !== 'live') return false

  const starts = parseUnix(getTagValue(event, 'starts'))
  const ends = parseUnix(getTagValue(event, 'ends'))

  if (starts && starts > now + 10 * 60) return false
  if (ends && ends <= now) return false

  return true
}

const LiveEventList = forwardRef<
  TLiveEventListRef,
  { onOpenStream?: (naddr: string, event: NostrEvent) => void }
>(({ onOpenStream }, ref) => {
  const { t } = useTranslation()
  const [events, setEvents] = useState<NostrEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const subCloserRef = useRef<{ close: () => void } | null>(null)
  const eventMapRef = useRef<Map<string, NostrEvent>>(new Map())
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearLoadingTimeout = useCallback(() => {
    if (!loadingTimeoutRef.current) return
    clearTimeout(loadingTimeoutRef.current)
    loadingTimeoutRef.current = null
  }, [])

  const clearReconnectTimeout = useCallback(() => {
    if (!reconnectTimeoutRef.current) return
    clearTimeout(reconnectTimeoutRef.current)
    reconnectTimeoutRef.current = null
  }, [])

  const updateEventList = useCallback(() => {
    const now = Math.floor(Date.now() / 1000)

    const activeEvents = Array.from(eventMapRef.current.values())
      .filter((event) => isActiveLiveStream(event, now))
      .sort((a, b) => {
        const aParticipants = Number.parseInt(getTagValue(a, 'current_participants') || '0', 10)
        const bParticipants = Number.parseInt(getTagValue(b, 'current_participants') || '0', 10)

        if (aParticipants !== bParticipants) {
          return bParticipants - aParticipants
        }

        return b.created_at - a.created_at
      })

    setEvents(activeEvents)
  }, [])

  const loadLiveEvents = useCallback(() => {
    clearReconnectTimeout()
    clearLoadingTimeout()
    setIsLoading(true)

    // Avoid a permanent skeleton if some relays never EOSE.
    loadingTimeoutRef.current = setTimeout(() => {
      setIsLoading(false)
      loadingTimeoutRef.current = null
    }, 12_000)

    if (subCloserRef.current) {
      subCloserRef.current.close()
    }
    eventMapRef.current.clear()
    setEvents([])

    // Seed with a one-shot query so back-navigation does not depend on subscription EOSE timing.
    client
      .querySync(LIVE_STREAM_RELAYS, {
        kinds: [30311],
        limit: 200
      })
      .then((seedEvents) => {
        for (const event of seedEvents) {
          const dTag = getTagValue(event, 'd')
          if (!dTag) continue

          const key = `${event.pubkey}:${dTag}`
          const existing = eventMapRef.current.get(key)
          if (!existing || event.created_at > existing.created_at) {
            eventMapRef.current.set(key, event)
          }
        }
        updateEventList()
        if (seedEvents.length > 0) {
          setIsLoading(false)
          clearLoadingTimeout()
        }
      })
      .catch(() => {
        // Ignore seed errors; live subscription remains the source of truth.
      })

    const sub = client.subscribe(
      LIVE_STREAM_RELAYS,
      {
        kinds: [30311],
        limit: 200
      },
      {
        onevent: (event: NostrEvent) => {
          const dTag = getTagValue(event, 'd')
          if (!dTag) return

          const key = `${event.pubkey}:${dTag}`
          const existing = eventMapRef.current.get(key)
          if (!existing || event.created_at > existing.created_at) {
            eventMapRef.current.set(key, event)
            updateEventList()
          }
          setIsLoading(false)
        },
        oneose: (eosed: boolean) => {
          if (eosed) {
            setIsLoading(false)
          }
        },
        onAllClose: (reasons) => {
          if (reasons.every((reason) => reason === 'closed by caller')) return
          clearReconnectTimeout()
          reconnectTimeoutRef.current = setTimeout(() => {
            loadLiveEvents()
          }, 5_000)
        }
      }
    )

    subCloserRef.current = sub
  }, [clearLoadingTimeout, clearReconnectTimeout, updateEventList])

  useEffect(() => {
    loadLiveEvents()

    const interval = setInterval(() => {
      updateEventList()
    }, 30_000)

    return () => {
      clearLoadingTimeout()
      clearReconnectTimeout()
      if (subCloserRef.current) {
        subCloserRef.current.close()
      }
      clearInterval(interval)
    }
  }, [clearLoadingTimeout, clearReconnectTimeout, loadLiveEvents, updateEventList])

  useImperativeHandle(ref, () => ({
    refresh: loadLiveEvents
  }))

  if (isLoading && events.length === 0) {
    return (
      <div className="p-4 space-y-4">
        {[...Array(3)].map((_, index) => (
          <LiveEventCardSkeleton key={index} />
        ))}
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-muted-foreground">{t('No live streams at the moment')}</p>
        <p className="text-sm text-muted-foreground mt-2">{t('Check back later for live events')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4">
      {events.map((event) => {
        const dTag = getTagValue(event, 'd') || ''
        const key = `${event.pubkey}:${dTag}`
        return <LiveEventCard key={key} event={event} onOpenStream={onOpenStream} />
      })}
    </div>
  )
})

LiveEventList.displayName = 'LiveEventList'
export default LiveEventList
