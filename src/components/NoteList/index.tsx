import NewNotesButton from '@/components/NewNotesButton'
import { Button } from '@/components/ui/button'
import {
  getReplaceableCoordinateFromEvent,
  hasMedia,
  hasExcessiveHashtags,
  hasExcessiveMentions,
  isMentioningMutedUsers,
  isReplaceableEvent,
  isReplyNoteEvent
} from '@/lib/event'
import { isTouchDevice } from '@/lib/utils'
import { useContentPolicy } from '@/providers/ContentPolicyProvider'
import { useDeletedEvent } from '@/providers/DeletedEventProvider'
import { useDistractionFreeMode } from '@/providers/DistractionFreeModeProvider'
import { useLowBandwidthMode } from '@/providers/LowBandwidthModeProvider'
import { useMuteList } from '@/providers/MuteListProvider'
import { useNostr } from '@/providers/NostrProvider'
import { useTextOnlyMode } from '@/providers/TextOnlyModeProvider'
import { useUserTrust } from '@/providers/UserTrustProvider'
import client from '@/services/client.service'
import noteStatsService from '@/services/note-stats.service'
import { TFeedSubRequest } from '@/types'
import dayjs from 'dayjs'
import { Event } from 'nostr-tools'
import { decode } from 'nostr-tools/nip19'
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from 'react'
import { useTranslation } from 'react-i18next'
import PullToRefresh from 'react-simple-pull-to-refresh'
import { toast } from 'sonner'
import NoteCard, { NoteCardLoadingSkeleton } from '../NoteCard'
import PinnedNoteCard from '../PinnedNoteCard'

const LIMIT = 200
const ALGO_LIMIT = 500
const SHOW_COUNT_STANDARD = 10
const SHOW_COUNT_TEXT_ONLY = 50

const NoteList = forwardRef(
  (
    {
      subRequests,
      showKinds,
      mediaOnly = false,
      filterMutedNotes = true,
      hideReplies = false,
      hideUntrustedNotes = false,
      areAlgoRelays = false,
      showRelayCloseReason = false,
      pinnedEventIds = [],
      onEventsChange
    }: {
      subRequests: TFeedSubRequest[]
      showKinds: number[]
      mediaOnly?: boolean
      filterMutedNotes?: boolean
      hideReplies?: boolean
      hideUntrustedNotes?: boolean
      areAlgoRelays?: boolean
      showRelayCloseReason?: boolean
      pinnedEventIds?: string[]
      onEventsChange?: (events: Event[]) => void
    },
    ref
  ) => {
    const { t } = useTranslation()
    const { startLogin, pubkey } = useNostr()
    const { lowBandwidthMode } = useLowBandwidthMode()
    const { isUserTrusted } = useUserTrust()
    const { textOnlyMode } = useTextOnlyMode()
    const { mutePubkeySet, getMutedWords } = useMuteList()
    const { hideContentMentioningMutedUsers, maxHashtags, maxMentions } = useContentPolicy()
    const mutedWords = useMemo(() => getMutedWords(), [getMutedWords])
    const mutedWordsLower = useMemo(() => mutedWords.map((word) => word.toLowerCase()), [mutedWords])
    const { isEventDeleted } = useDeletedEvent()
    const { isDistractionFree } = useDistractionFreeMode()
    const showCountIncrement = textOnlyMode ? SHOW_COUNT_TEXT_ONLY : SHOW_COUNT_STANDARD
    const [events, setEvents] = useState<Event[]>([])
    const [newEvents, setNewEvents] = useState<Event[]>([])
    const [hasMore, setHasMore] = useState<boolean>(true)
    const [loading, setLoading] = useState(true)
    const [timelineKey, setTimelineKey] = useState<string | undefined>(undefined)
    const [refreshCount, setRefreshCount] = useState(0)
    const [showCount, setShowCount] = useState(showCountIncrement)
    const supportTouch = useMemo(() => isTouchDevice(), [])
    const bottomRef = useRef<HTMLDivElement | null>(null)
    const topRef = useRef<HTMLDivElement | null>(null)
    const pinnedEventHexIdSet = useMemo(() => {
      const set = new Set<string>()
      pinnedEventIds.forEach((id) => {
        try {
          const { type, data } = decode(id)
          if (type === 'nevent') {
            set.add(data.id)
          }
        } catch {
          // ignore invalid ids
        }
      })
      return set
    }, [pinnedEventIds.join(',')])

    const shouldHideEvent = useCallback(
      (evt: Event) => {
        if (pinnedEventHexIdSet.has(evt.id)) return true
        if (isEventDeleted(evt)) return true
        if (hideReplies && isReplyNoteEvent(evt)) return true
        if (hideUntrustedNotes && !isUserTrusted(evt.pubkey)) return true
        if (filterMutedNotes && mutePubkeySet.has(evt.pubkey)) return true
        if (
          filterMutedNotes &&
          hideContentMentioningMutedUsers &&
          isMentioningMutedUsers(evt, mutePubkeySet)
        ) {
          return true
        }

        // Check for muted words in content
        if (filterMutedNotes && mutedWordsLower.length > 0) {
          const content = evt.content.toLowerCase()
          if (mutedWordsLower.some((word) => content.includes(word))) {
            return true
          }
        }

        // Check media only filter
        if (mediaOnly && !hasMedia(evt)) {
          return true
        }

        // Check hashtag spam filter
        if (hasExcessiveHashtags(evt, maxHashtags)) {
          return true
        }

        // Check mention spam filter
        if (hasExcessiveMentions(evt, maxMentions)) {
          return true
        }

        return false
      },
      [
        hideReplies,
        hideUntrustedNotes,
        mutePubkeySet,
        pinnedEventHexIdSet,
        isEventDeleted,
        filterMutedNotes,
        mutedWordsLower,
        hideContentMentioningMutedUsers,
        isUserTrusted,
        mediaOnly,
        maxHashtags,
        maxMentions
      ]
    )

    const filteredEvents = useMemo(() => {
      const idSet = new Set<string>()

      return events.slice(0, showCount).filter((evt) => {
        if (shouldHideEvent(evt)) return false

        const id = isReplaceableEvent(evt.kind) ? getReplaceableCoordinateFromEvent(evt) : evt.id
        if (idSet.has(id)) {
          return false
        }
        idSet.add(id)
        return true
      })
    }, [events, showCount, shouldHideEvent])

    const filteredNewEvents = useMemo(() => {
      const idSet = new Set<string>()

      return newEvents.filter((event: Event) => {
        if (shouldHideEvent(event)) return false

        const id = isReplaceableEvent(event.kind)
          ? getReplaceableCoordinateFromEvent(event)
          : event.id
        if (idSet.has(id)) {
          return false
        }
        idSet.add(id)
        return true
      })
    }, [newEvents, shouldHideEvent])

    const scrollToTop = (behavior: ScrollBehavior = 'instant') => {
      setTimeout(() => {
        topRef.current?.scrollIntoView({ behavior, block: 'start' })
      }, 20)
    }

    const refresh = () => {
      scrollToTop()
      setTimeout(() => {
        setRefreshCount((count) => count + 1)
      }, 500)
    }

    useImperativeHandle(ref, () => ({ scrollToTop, refresh }), [])

    useEffect(() => {
      if (!subRequests.length) return

      async function init() {
        setLoading(true)
        setEvents([])
        setNewEvents([])
        setHasMore(true)

        if (showKinds.length === 0) {
          setLoading(false)
          setHasMore(false)
          return () => {}
        }

        const { closer, timelineKey } = await client.subscribeTimeline(
          subRequests.map(({ urls, filter }) => ({
            urls,
            filter: {
              kinds: showKinds,
              ...filter,
              limit: areAlgoRelays ? ALGO_LIMIT : LIMIT
            }
          })),
          {
            onEvents: (events, eosed) => {
              if (events.length > 0) {
                setEvents(events)
              }
              if (areAlgoRelays) {
                setHasMore(false)
              }
              if (eosed) {
                setLoading(false)
                setHasMore(events.length > 0)
              }
            },
            onNew: (event) => {
              if (pubkey && event.pubkey === pubkey) {
                // If the new event is from the current user, insert it directly into the feed
                setEvents((oldEvents) =>
                  oldEvents.some((e) => e.id === event.id) ? oldEvents : [event, ...oldEvents]
                )
              } else {
                // Otherwise, buffer it and show the New Notes button
                setNewEvents((oldEvents) =>
                  [event, ...oldEvents].sort((a, b) => b.created_at - a.created_at)
                )
              }
            },
            onClose: (url, reason) => {
              if (!showRelayCloseReason) return
              // ignore reasons from nostr-tools
              if (
                [
                  'closed by caller',
                  'relay connection errored',
                  'relay connection closed',
                  'pingpong timed out',
                  'relay connection closed by us'
                ].includes(reason)
              ) {
                return
              }

              toast.error(`${url}: ${reason}`)
            }
          },
          {
            startLogin,
            needSort: !areAlgoRelays
          }
        )
        setTimelineKey(timelineKey)
        return closer
      }

      const promise = init()
      return () => {
        promise.then((closer) => closer())
      }
    }, [JSON.stringify(subRequests), refreshCount, showKinds])

    useEffect(() => {
      if (onEventsChange) {
        onEventsChange(events)
      }
    }, [events, onEventsChange])

    useEffect(() => {
      if (lowBandwidthMode || !events.length) return

      const notesToPrefetch = events.slice(
        0,
        Math.min(events.length, Math.max(showCount + 60, showCountIncrement * 12))
      )
      const relayUrls = Array.from(new Set(subRequests.flatMap((request) => request.urls))).slice(0, 20)
      noteStatsService.prefetchNoteStats(notesToPrefetch, pubkey, undefined, relayUrls)
    }, [events, showCount, showCountIncrement, pubkey, lowBandwidthMode, subRequests])

    useEffect(() => {
      const options = {
        root: null,
        rootMargin: '10px',
        threshold: 0.1
      }

      const loadMore = async () => {
        if (showCount < events.length) {
          setShowCount((prev) => prev + showCountIncrement)
          // preload more
          if (events.length - showCount > LIMIT / 2) {
            return
          }
        }

        if (!timelineKey || loading || !hasMore) return
        setLoading(true)
        const newEvents = await client.loadMoreTimeline(
          timelineKey,
          events.length ? events[events.length - 1].created_at - 1 : dayjs().unix(),
          LIMIT
        )
        setLoading(false)
        if (newEvents.length === 0) {
          setHasMore(false)
          return
        }
        setEvents((oldEvents) => [...oldEvents, ...newEvents])
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
    }, [loading, hasMore, events, showCount, timelineKey])

    const showNewEvents = () => {
      setEvents((oldEvents) => [...newEvents, ...oldEvents])
      setNewEvents([])
      setTimeout(() => {
        scrollToTop('smooth')
      }, 0)
    }

    const list = (
      <div className="min-h-screen">
        <ul role="feed" aria-label="Notes feed" className="list-none">
          {pinnedEventIds.map((id) => (
            <li key={id}>
              <PinnedNoteCard eventId={id} className="w-full" />
            </li>
          ))}
          {filteredEvents.map((event) => (
            <li key={event.id}>
              <NoteCard
                className="w-full"
                event={event}
                filterMutedNotes={filterMutedNotes}
              />
            </li>
          ))}
        </ul>
        {hasMore || loading ? (
          <div ref={bottomRef}>
            <div role="status" aria-live="polite" className="sr-only">
              {loading && t('Loading more posts')}
            </div>
            <NoteCardLoadingSkeleton />
          </div>
        ) : events.length ? (
          <div role="status" aria-live="polite" className="text-center text-sm text-muted-foreground mt-2">{t('no more notes')}</div>
        ) : (
          <div className="flex justify-center w-full mt-2">
            <Button size="lg" onClick={() => setRefreshCount((count) => count + 1)}>
              {t('reload notes')}
            </Button>
          </div>
        )}
      </div>
    )

    return (
      <div>
        {filteredNewEvents.length > 0 && !isDistractionFree && (
          <NewNotesButton newEvents={filteredNewEvents} onClick={showNewEvents} />
        )}
        <div ref={topRef} className="scroll-mt-[calc(6rem+1px)]" />
        {supportTouch ? (
          <PullToRefresh
            onRefresh={async () => {
              refresh()
              await new Promise((resolve) => setTimeout(resolve, 1000))
            }}
            pullingContent=""
          >
            {list}
          </PullToRefresh>
        ) : (
          list
        )}
        <div className="h-40" />
      </div>
    )
  }
)
NoteList.displayName = 'NoteList'
export default NoteList

export type TNoteListRef = {
  scrollToTop: (behavior?: ScrollBehavior) => void
  refresh: () => void
}
