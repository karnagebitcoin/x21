import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Event as NostrEvent } from 'nostr-tools'
import client from '@/services/client.service'
import LiveEventCard from '@/components/LiveEventCard'
import { LiveEventCardSkeleton } from '@/components/LiveEventCard'

export type TLiveEventListRef = {
  refresh: () => void
}

const LIVE_STREAM_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
  'wss://nostr.mom',
  'wss://relay.snort.social',
  'wss://relay.primal.net',
  'wss://nostr.wine'
]

function getTagValue(event: NostrEvent, tagName: string): string | undefined {
  return event.tags.find((tag) => tag[0] === tagName)?.[1]
}

function parseUnix(value?: string): number | null {
  if (!value) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function isActiveLiveStream(event: NostrEvent, now: number): boolean {
  const status = getTagValue(event, 'status')?.toLowerCase()
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
    setIsLoading(true)

    if (subCloserRef.current) {
      subCloserRef.current.close()
    }
    eventMapRef.current.clear()
    setEvents([])

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
        },
        oneose: (eosed: boolean) => {
          if (eosed) setIsLoading(false)
        }
      }
    )

    subCloserRef.current = sub
  }, [updateEventList])

  useEffect(() => {
    loadLiveEvents()

    const interval = setInterval(() => {
      updateEventList()
    }, 30_000)

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
