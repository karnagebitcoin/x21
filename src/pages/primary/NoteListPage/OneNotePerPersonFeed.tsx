import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { Event, kinds } from 'nostr-tools'
import { useNostr } from '@/providers/NostrProvider'
import { useFeed } from '@/providers/FeedProvider'
import client from '@/services/client.service'
import { TFeedSubRequest } from '@/types'
import NoteCard, { NoteCardLoadingSkeleton } from '@/components/NoteCard'
import { RefreshButton } from '@/components/RefreshButton'
import { useTranslation } from 'react-i18next'
import { isTouchDevice } from '@/lib/utils'
import { useKindFilter } from '@/providers/KindFilterProvider'
import { useMuteList } from '@/providers/MuteListProvider'
import { useDeletedEvent } from '@/providers/DeletedEventProvider'
import { isReplyNoteEvent } from '@/lib/event'
import KindFilter from '@/components/KindFilter'
import Tabs from '@/components/Tabs'
import PullToRefresh from 'react-simple-pull-to-refresh'

const LIMIT = 500

export default function OneNotePerPersonFeed() {
  const { t } = useTranslation()
  const { pubkey } = useNostr()
  const { feedInfo } = useFeed()
  const [subRequests, setSubRequests] = useState<TFeedSubRequest[]>([])
  const [allEvents, setAllEvents] = useState<Event[]>([])
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshCount, setRefreshCount] = useState(0)
  const [timelineKey, setTimelineKey] = useState<string | undefined>(undefined)
  const { showKinds } = useKindFilter()
  const [temporaryShowKinds, setTemporaryShowKinds] = useState(showKinds)
  const { mutePubkeySet } = useMuteList()
  const { isEventDeleted } = useDeletedEvent()
  const supportTouch = useMemo(() => isTouchDevice(), [])
  const [hideReplies, setHideReplies] = useState(true)
  const topRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function init() {
      if (feedInfo.feedType !== 'one-per-person' || !pubkey) {
        setSubRequests([])
        setAllEvents([])
        setFilteredEvents([])
        return
      }

      setLoading(true)
      const followings = await client.fetchFollowings(pubkey)
      console.log(`[OneNotePerPersonFeed] Found ${followings.length} followings`)
      const requests = await client.generateSubRequestsForPubkeys([pubkey, ...followings], pubkey)
      console.log(`[OneNotePerPersonFeed] Generated ${requests.length} subscription requests`)
      setSubRequests(requests)
    }

    init()
  }, [feedInfo.feedType, pubkey, refreshCount])

  useEffect(() => {
    if (!subRequests.length) {
      setLoading(false)
      return
    }

    async function subscribe() {
      setLoading(true)
      setAllEvents([])
      setHasMore(true)

      const { closer, timelineKey } = await client.subscribeTimeline(
        subRequests.map((req) => ({
          urls: req.urls,
          filter: {
            ...req.filter,
            kinds: temporaryShowKinds,
            limit: LIMIT
          }
        })),
        {
          onEvents: (events, eosed) => {
            console.log(`[OneNotePerPersonFeed] Received ${events.length} events, eosed: ${eosed}`)
            if (events.length > 0) {
              setAllEvents(events)
            }
            if (eosed) {
              setLoading(false)
              setHasMore(events.length > 0)
            }
          },
          onNew: (event: Event) => {
            setAllEvents((prev) => {
              // Check if we already have this event
              if (prev.some((e) => e.id === event.id)) {
                return prev
              }
              // Add the new event and re-sort
              return [...prev, event].sort((a, b) => b.created_at - a.created_at)
            })
          }
        }
      )

      setTimelineKey(timelineKey)
      return closer
    }

    const closerPromise = subscribe()

    return () => {
      closerPromise.then((closer) => closer?.())
    }
  }, [subRequests, temporaryShowKinds, refreshCount])

  // Filter events to one per person
  useEffect(() => {
    // Group events by author
    const eventsByAuthor = new Map<string, Event>()

    allEvents.forEach((event) => {
      // Skip if event is invalid or should be hidden
      if (!event || !event.pubkey) return
      if (isEventDeleted(event)) return
      if (mutePubkeySet.has(event.pubkey)) return
      if (hideReplies && isReplyNoteEvent(event)) return
      // Skip reposts - we want to see original content only
      if (event.kind === kinds.Repost) return

      const existing = eventsByAuthor.get(event.pubkey)
      if (!existing || event.created_at > existing.created_at) {
        eventsByAuthor.set(event.pubkey, event)
      }
    })

    // Convert to array and sort by timestamp (most recent first)
    const onePerPerson = Array.from(eventsByAuthor.values())
      .filter(event => event && event.pubkey) // Extra safety check
      .sort((a, b) => b.created_at - a.created_at)

    console.log(`[OneNotePerPersonFeed] Filtered to ${onePerPerson.length} unique authors from ${allEvents.length} total events`)
    setFilteredEvents(onePerPerson)
  }, [allEvents, mutePubkeySet, isEventDeleted, hideReplies])

  // Implement infinite scrolling with IntersectionObserver
  useEffect(() => {
    const options = {
      root: null,
      rootMargin: '10px',
      threshold: 0.1
    }

    const loadMore = async () => {
      if (!timelineKey || loading || loadingMore || !hasMore || allEvents.length === 0) return

      setLoadingMore(true)
      console.log(`[OneNotePerPersonFeed] Loading more events from timestamp ${allEvents[allEvents.length - 1].created_at - 1}`)

      const newEvents = await client.loadMoreTimeline(
        timelineKey,
        allEvents[allEvents.length - 1].created_at - 1,
        LIMIT
      )

      setLoadingMore(false)

      if (newEvents.length === 0) {
        console.log('[OneNotePerPersonFeed] No more events to load')
        setHasMore(false)
        return
      }

      console.log(`[OneNotePerPersonFeed] Loaded ${newEvents.length} more events`)
      setAllEvents((oldEvents) => [...oldEvents, ...newEvents])
    }

    const observerInstance = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore) {
        loadMore()
      }
    }, options)

    const currentBottomRef = bottomRef.current

    if (currentBottomRef) {
      observerInstance.observe(currentBottomRef)
    }

    return () => {
      if (observerInstance && currentBottomRef) {
        observerInstance.unobserve(currentBottomRef)
      }
    }
  }, [loading, loadingMore, hasMore, allEvents, timelineKey])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    setAllEvents([])
    setFilteredEvents([])
    setRefreshCount((c) => c + 1)

    // Wait a bit for the refresh to complete
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setRefreshing(false)
  }, [])

  const scrollToTop = useCallback((behavior: ScrollBehavior = 'smooth') => {
    topRef.current?.scrollIntoView({ behavior })
  }, [])

  const handleShowKindsChange = (newShowKinds: number[]) => {
    setTemporaryShowKinds(newShowKinds)
    setAllEvents([])
    setFilteredEvents([])
    scrollToTop('instant')
  }

  const handleListModeChange = (mode: 'posts' | 'postsAndReplies') => {
    setHideReplies(mode === 'posts')
    scrollToTop('smooth')
  }

  const content = (
    <div>
      <div ref={topRef} />
      <Tabs
        value={hideReplies ? 'posts' : 'postsAndReplies'}
        tabs={[
          { value: 'posts', label: 'Notes' },
          { value: 'postsAndReplies', label: 'Replies' }
        ]}
        onTabChange={(mode) => {
          handleListModeChange(mode as 'posts' | 'postsAndReplies')
        }}
        options={
          <>
            {!supportTouch && <RefreshButton onClick={handleRefresh} />}
            <KindFilter
              showKinds={temporaryShowKinds}
              onShowKindsChange={handleShowKindsChange}
              mediaOnly={false}
              onMediaOnlyChange={() => {}}
            />
          </>
        }
      />

      {loading && filteredEvents.length === 0 && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <NoteCardLoadingSkeleton key={i} />
          ))}
        </div>
      )}

      {!loading && filteredEvents.length === 0 && (
        <div className="text-center text-sm text-muted-foreground py-8">
          {t('No notes found')}
        </div>
      )}

      {filteredEvents.length > 0 && (
        <div className="space-y-2">
          {filteredEvents.map((event) => (
            <NoteCard key={event.id} event={event} />
          ))}
        </div>
      )}

      {loadingMore && (
        <div className="space-y-2 mt-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <NoteCardLoadingSkeleton key={i} />
          ))}
        </div>
      )}

      <div ref={bottomRef} className="h-4" />
    </div>
  )

  if (supportTouch) {
    return (
      <PullToRefresh onRefresh={handleRefresh} isPullable={!refreshing}>
        {content}
      </PullToRefresh>
    )
  }

  return content
}
