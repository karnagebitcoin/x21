import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { TFeedSubRequest } from '@/types'
import { Event } from 'nostr-tools'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import client from '@/services/client.service'
import ArticleCard from '../ArticleCard'
import { isTouchDevice } from '@/lib/utils'
import PullToRefresh from 'react-simple-pull-to-refresh'
import { getReplaceableCoordinateFromEvent, isReplaceableEvent } from '@/lib/event'
import dayjs from 'dayjs'
import { useNostr } from '@/providers/NostrProvider'

const LIMIT = 50
const SHOW_COUNT = 10

export type TArticleListRef = {
  refresh: () => void
  scrollToTop: (behavior?: ScrollBehavior) => void
}

const ArticleList = forwardRef(
  (
    {
      subRequests
    }: {
      subRequests: TFeedSubRequest[]
    },
    ref
  ) => {
    const { t } = useTranslation()
    const { startLogin } = useNostr()
    const [articles, setArticles] = useState<Event[]>([])
    const [loading, setLoading] = useState(true)
    const [hasMore, setHasMore] = useState<boolean>(true)
    const [showCount, setShowCount] = useState(SHOW_COUNT)
    const [timelineKey, setTimelineKey] = useState<string | undefined>(undefined)
    const [refreshCount, setRefreshCount] = useState(0)
    const supportTouch = useMemo(() => isTouchDevice(), [])
    const bottomRef = useRef<HTMLDivElement | null>(null)
    const topRef = useRef<HTMLDivElement | null>(null)

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

    useImperativeHandle(ref, () => ({
      refresh,
      scrollToTop
    }))

    useEffect(() => {
      if (!subRequests.length) return

      async function init() {
        setLoading(true)
        setArticles([])
        setHasMore(true)

        const { closer, timelineKey } = await client.subscribeTimeline(
          subRequests.map(({ urls, filter }) => ({
            urls,
            filter: {
              kinds: [30023], // Long-form content
              ...filter,
              limit: LIMIT
            }
          })),
          {
            onEvents: (events, eosed) => {
              if (events.length > 0) {
                setArticles(events)
              }
              if (eosed) {
                setLoading(false)
                setHasMore(events.length > 0)
              }
            },
            onNew: (event) => {
              // Insert new articles at the top
              setArticles((oldArticles) =>
                oldArticles.some((e) => e.id === event.id) ? oldArticles : [event, ...oldArticles]
              )
            }
          },
          {
            startLogin
          }
        )
        setTimelineKey(timelineKey)
        return closer
      }

      const promise = init()
      return () => {
        promise.then((closer) => closer())
      }
    }, [JSON.stringify(subRequests), refreshCount])

    useEffect(() => {
      const options = {
        root: null,
        rootMargin: '10px',
        threshold: 0.1
      }

      const loadMore = async () => {
        if (showCount < articles.length) {
          setShowCount((prev) => prev + SHOW_COUNT)
          // preload more
          if (articles.length - showCount > LIMIT / 2) {
            return
          }
        }

        if (!timelineKey || loading || !hasMore) return
        setLoading(true)
        const newArticles = await client.loadMoreTimeline(
          timelineKey,
          articles.length ? articles[articles.length - 1].created_at - 1 : dayjs().unix(),
          LIMIT
        )
        setLoading(false)
        if (newArticles.length === 0) {
          setHasMore(false)
          return
        }
        setArticles((oldArticles) => [...oldArticles, ...newArticles])
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
    }, [loading, hasMore, articles, showCount, timelineKey])

    const displayedArticles = useMemo(() => {
      // Titles to filter out (exact matches only)
      const filteredTitles = [t('Untitled'), 'Untitled Draft', 'Draft', 'Test', 'Testing']

      // Remove duplicates by d-tag identifier (keep most recent version)
      const uniqueArticles = new Map<string, Event>()
      articles.forEach((event) => {
        const dTag = event.tags.find((tag) => tag[0] === 'd')?.[1]
        const key = `${event.pubkey}:${dTag || event.id}`

        // Keep the most recent version
        const existing = uniqueArticles.get(key)
        if (!existing || event.created_at > existing.created_at) {
          uniqueArticles.set(key, event)
        }
      })

      return Array.from(uniqueArticles.values())
        .filter((event) => {
          // Filter out articles with exact titles we want to exclude
          const titleTag = event.tags.find((tag) => tag[0] === 'title')
          const title = titleTag?.[1] || t('Untitled')
          return !filteredTitles.includes(title)
        })
        .sort((a, b) => {
          // Sort by published_at if available, otherwise by created_at
          const aPublishedAt = parseInt(a.tags.find((tag) => tag[0] === 'published_at')?.[1] || '0') || a.created_at
          const bPublishedAt = parseInt(b.tags.find((tag) => tag[0] === 'published_at')?.[1] || '0') || b.created_at
          return bPublishedAt - aPublishedAt
        })
        .slice(0, showCount)
    }, [articles, showCount])

    const handleRefresh = async () => {
      refresh()
    }

    const content = (
      <div className="pb-4">
        <div ref={topRef} />
        {loading && articles.length === 0 ? (
          <div>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-4 py-4 px-4 border-b border-border">
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
                <Skeleton className="w-32 h-24 rounded-lg flex-shrink-0" />
              </div>
            ))}
          </div>
        ) : displayedArticles.length > 0 ? (
          <div>
            {displayedArticles.map((article) => (
              <ArticleCard key={article.id} event={article} />
            ))}
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-12">
            {t('No articles found')}
          </div>
        )}
        <div ref={bottomRef} className="h-1" />
        {!loading && hasMore && displayedArticles.length > 0 && (
          <div className="text-center py-4">
            <Button
              variant="outline"
              onClick={() => setShowCount((prev) => prev + SHOW_COUNT)}
            >
              {t('Load More')}
            </Button>
          </div>
        )}
      </div>
    )

    if (supportTouch) {
      return (
        <PullToRefresh onRefresh={handleRefresh} resistance={3}>
          {content}
        </PullToRefresh>
      )
    }

    return content
  }
)

ArticleList.displayName = 'ArticleList'

export default ArticleList
