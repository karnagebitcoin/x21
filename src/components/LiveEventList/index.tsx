import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Event as NostrEvent } from 'nostr-tools'
import client from '@/services/client.service'
import LiveEventCard from '@/components/LiveEventCard'
import { LiveEventCardSkeleton } from '@/components/LiveEventCard'
import RelayFetchState from '@/components/RelayFetchState'
import { getLiveStreamTagValue, isActiveLiveStream, LIVE_STREAM_RELAYS } from '@/lib/live-stream'

export type TLiveEventListRef = {
  refresh: () => void
}

const LiveEventList = forwardRef<
  TLiveEventListRef,
  { onOpenStream?: (naddr: string, event: NostrEvent) => void }
>(({ onOpenStream }, ref) => {
  const [events, setEvents] = useState<NostrEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const subCloserRef = useRef<{ close: () => void } | null>(null)
  const eventMapRef = useRef<Map<string, NostrEvent>>(new Map())
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const slowLoadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isSlowLoading, setIsSlowLoading] = useState(false)

  const clearLoadingTimeout = useCallback(() => {
    if (!loadingTimeoutRef.current) return
    clearTimeout(loadingTimeoutRef.current)
    loadingTimeoutRef.current = null
  }, [])

  const clearSlowLoadingTimeout = useCallback(() => {
    if (!slowLoadingTimeoutRef.current) return
    clearTimeout(slowLoadingTimeoutRef.current)
    slowLoadingTimeoutRef.current = null
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
        const aParticipants = Number.parseInt(
          getLiveStreamTagValue(a, 'current_participants') || '0',
          10
        )
        const bParticipants = Number.parseInt(
          getLiveStreamTagValue(b, 'current_participants') || '0',
          10
        )

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
    clearSlowLoadingTimeout()
    setIsLoading(true)
    setIsSlowLoading(false)

    // Avoid a permanent skeleton if some relays never EOSE.
    loadingTimeoutRef.current = setTimeout(() => {
      setIsLoading(false)
      loadingTimeoutRef.current = null
    }, 12_000)
    slowLoadingTimeoutRef.current = setTimeout(() => {
      setIsSlowLoading(true)
      slowLoadingTimeoutRef.current = null
    }, 3500)

    if (subCloserRef.current) {
      subCloserRef.current.close()
    }
    eventMapRef.current.clear()
    setEvents([])

    // Use warm cache first when available for instant paint.
    const cachedEvents = client.getCachedLiveStreamEvents()
    if (cachedEvents.length > 0) {
      for (const event of cachedEvents) {
        const dTag = getLiveStreamTagValue(event, 'd')
        if (!dTag) continue
        eventMapRef.current.set(`${event.pubkey}:${dTag}`, event)
      }
      updateEventList()
      setIsLoading(false)
      setIsSlowLoading(false)
      clearLoadingTimeout()
      clearSlowLoadingTimeout()
    }

    // Then refresh cache from relays in the background.
    client
      .prefetchLiveStreamEvents({ relays: LIVE_STREAM_RELAYS })
      .then((seedEvents) => {
        for (const event of seedEvents) {
          const dTag = getLiveStreamTagValue(event, 'd')
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
          setIsSlowLoading(false)
          clearLoadingTimeout()
          clearSlowLoadingTimeout()
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
          const dTag = getLiveStreamTagValue(event, 'd')
          if (!dTag) return

          const key = `${event.pubkey}:${dTag}`
          const existing = eventMapRef.current.get(key)
          if (!existing || event.created_at > existing.created_at) {
            eventMapRef.current.set(key, event)
            updateEventList()
          }
          client.cacheLiveStreamEvents([event])
          setIsLoading(false)
          setIsSlowLoading(false)
          clearSlowLoadingTimeout()
        },
        oneose: (eosed: boolean) => {
          if (eosed) {
            setIsLoading(false)
            setIsSlowLoading(false)
            clearSlowLoadingTimeout()
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
  }, [clearLoadingTimeout, clearReconnectTimeout, clearSlowLoadingTimeout, updateEventList])

  useEffect(() => {
    loadLiveEvents()

    const interval = setInterval(() => {
      updateEventList()
    }, 30_000)

    return () => {
      clearLoadingTimeout()
      clearReconnectTimeout()
      clearSlowLoadingTimeout()
      if (subCloserRef.current) {
        subCloserRef.current.close()
      }
      clearInterval(interval)
    }
  }, [clearLoadingTimeout, clearReconnectTimeout, clearSlowLoadingTimeout, loadLiveEvents, updateEventList])

  useImperativeHandle(ref, () => ({
    refresh: loadLiveEvents
  }))

  if (isLoading && events.length === 0) {
    if (isSlowLoading) {
      return (
        <RelayFetchState
          mode="slow"
          relayCount={LIVE_STREAM_RELAYS.length}
          onRetry={loadLiveEvents}
          className="pt-16"
        />
      )
    }
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
      <RelayFetchState
        mode="not-found"
        relayCount={LIVE_STREAM_RELAYS.length}
        onRetry={loadLiveEvents}
        className="py-16"
      />
    )
  }

  return (
    <div className="space-y-4 p-4">
      {events.map((event) => {
        const dTag = getLiveStreamTagValue(event, 'd') || ''
        const key = `${event.pubkey}:${dTag}`
        return <LiveEventCard key={key} event={event} onOpenStream={onOpenStream} />
      })}
    </div>
  )
})

LiveEventList.displayName = 'LiveEventList'
export default LiveEventList
