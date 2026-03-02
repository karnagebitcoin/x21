import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Event } from 'nostr-tools'
import client from '@/services/client.service'
import LiveEventCard from '@/components/LiveEventCard'
import { Skeleton } from '@/components/ui/skeleton'
import { useCurrentRelays } from '@/providers/CurrentRelaysProvider'
import { BIG_RELAY_URLS } from '@/constants'

export type TLiveEventListRef = {
  refresh: () => void
}

// Specialized relays that are known to have live streaming events
const LIVE_STREAM_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
  'wss://nostr.mom',
  'wss://relay.snort.social',
  'wss://relay.primal.net',
  'wss://nostr.wine'
]

const LiveEventList = forwardRef<TLiveEventListRef>((_, ref) => {
  const { t } = useTranslation()
  const { relayUrls } = useCurrentRelays()
  const [events, setEvents] = useState<Event[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const subCloserRef = useRef<{ close: () => void } | null>(null)
  const eventMapRef = useRef<Map<string, Event>>(new Map())

  const updateEventList = useCallback(() => {
    const now = Math.floor(Date.now() / 1000)
    const hourAgo = now - 3600

    console.log('[LiveEventList] Updating event list. Total events in map:', eventMapRef.current.size)

    // Filter and sort events - for debugging, let's show ALL events first
    const allEvents = Array.from(eventMapRef.current.values())
    console.log('[LiveEventList] All events:', allEvents.map(e => ({
      id: e.id.substring(0, 8),
      status: event.tags.find(t => t[0] === 'status')?.[1],
      created_at: e.created_at,
      title: event.tags.find(t => t[0] === 'title')?.[1]
    })))

    const liveEvents = allEvents
      .filter(e => {
        const status = event.tags.find(t => t[0] === 'status')?.[1]?.toLowerCase()

        // For debugging, let's be more lenient - show live, planned, and ended streams
        // We'll just filter out really stale ones
        if (e.created_at < hourAgo - (24 * 3600)) { // older than 25 hours
          console.log('[LiveEventList] Filtering out - too old')
          return false
        }

        return true
      })
      .sort((a, b) => {
        // Sort by status first: live > planned > ended
        const getStatusPriority = (event: Event) => {
          const status = event.tags.find(t => t[0] === 'status')?.[1]?.toLowerCase()
          if (status === 'live') return 0
          if (status === 'planned') return 1
          return 2
        }

        const statusDiff = getStatusPriority(a) - getStatusPriority(b)
        if (statusDiff !== 0) return statusDiff

        // Then by participants
        const aParticipants = parseInt(a.tags.find(t => t[0] === 'current_participants')?.[1] || '0')
        const bParticipants = parseInt(b.tags.find(t => t[0] === 'current_participants')?.[1] || '0')

        if (aParticipants !== bParticipants) {
          return bParticipants - aParticipants
        }

        // Then by created_at
        return b.created_at - a.created_at
      })

    console.log('[LiveEventList] After filtering, events count:', liveEvents.length)
    setEvents(liveEvents)
  }, [])

  const loadLiveEvents = useCallback(async () => {
    console.log('[LiveEventList] Starting to load live events...')

    // Use specialized live streaming relays for better results
    const relaysToUse = LIVE_STREAM_RELAYS
    console.log('[LiveEventList] Using relays:', relaysToUse)

    setIsLoading(true)

    // Unsubscribe from previous subscription
    if (subCloserRef.current) {
      subCloserRef.current.close()
    }

    // Clear the event map for fresh data
    eventMapRef.current.clear()

    console.log('[LiveEventList] Subscribing with filter:', { kinds: [30311], limit: 100 })

    // Subscribe to live streaming events (kind:30311)
    const sub = client.subscribe(
      relaysToUse,
      {
        kinds: [30311],
        limit: 100
      },
      {
        onevent: (event: Event) => {
          console.log('[LiveEventList] Received event:', {
            id: event.id.substring(0, 8),
            status: event.tags.find(t => t[0] === 'status')?.[1],
            title: event.tags.find(t => t[0] === 'title')?.[1],
            d: event.tags.find(t => t[0] === 'd')?.[1]
          })

          // Use 'd' tag + pubkey as unique identifier for addressable events per NIP-33
          const dTag = event.tags.find(t => t[0] === 'd')?.[1]
          if (!dTag) {
            console.warn('[LiveEventList] Skipping event without d tag:', event)
            return
          }

          const key = `${event.pubkey}:${dTag}`

          // Only keep the latest version of each addressable event
          const existing = eventMapRef.current.get(key)
          if (!existing || event.created_at > existing.created_at) {
            eventMapRef.current.set(key, event)
            console.log('[LiveEventList] Added event to map. Total events:', eventMapRef.current.size)
            updateEventList()
          }
        },
        oneose: (eosed: boolean) => {
          console.log('[LiveEventList] EOSE received. Eosed:', eosed, 'Events in map:', eventMapRef.current.size)
          if (eosed) {
            setIsLoading(false)
          }
        },
        onclose: (url: string, reason: string) => {
          console.log('[LiveEventList] Relay closed:', url, 'Reason:', reason)
        }
      }
    )

    subCloserRef.current = sub
  }, [updateEventList])

  useEffect(() => {
    loadLiveEvents()

    // Auto-refresh every 30 seconds to update participant counts
    const interval = setInterval(() => {
      updateEventList()
    }, 30000)

    return () => {
      if (subCloserRef.current) {
        subCloserRef.current.close()
      }
      clearInterval(interval)
    }
  }, [loadLiveEvents, updateEventList])

  useImperativeHandle(ref, () => ({
    refresh: loadLiveEvents
  }))

  if (isLoading && events.length === 0) {
    return (
      <div className="p-4 space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="border rounded-lg p-4 space-y-3">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <div className="flex gap-2">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-20" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-muted-foreground">{t('No live streams at the moment')}</p>
        <p className="text-sm text-muted-foreground mt-2">
          {t('Check back later for live events')}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4">
      {events.map(event => {
        const dTag = event.tags.find(t => t[0] === 'd')?.[1] || ''
        const key = `${event.pubkey}:${dTag}`
        return <LiveEventCard key={key} event={event} />
      })}
    </div>
  )
})

LiveEventList.displayName = 'LiveEventList'
export default LiveEventList
