import { extractMediaUrls, hasMedia } from '@/lib/event'
import { Event } from 'nostr-tools'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Lightbox from 'yet-another-react-lightbox'
import Zoom from 'yet-another-react-lightbox/plugins/zoom'
import Video from 'yet-another-react-lightbox/plugins/video'
import { createPortal } from 'react-dom'
import modalManager from '@/services/modal-manager.service'
import { randomString } from '@/lib/random'
import { TFeedSubRequest } from '@/types'
import client from '@/services/client.service'

interface MediaItem {
  url: string
  type: 'image' | 'video'
  eventId: string
  createdAt: number
}

export type TMediaGridRef = {
  scrollToTop: (behavior?: ScrollBehavior) => void
  addEvents: (events: Event[]) => void
  clearEvents: () => void
  refresh: () => void
}

const MediaGrid = forwardRef(
  (
    { subRequests }: { subRequests?: TFeedSubRequest[] },
    ref
  ) => {
    const { t } = useTranslation()
    const [events, setEvents] = useState<Event[]>([])
    const [lightboxIndex, setLightboxIndex] = useState(-1)
    const lightboxId = useMemo(() => `media-grid-lightbox-${randomString()}`, [])
    const topRef = useRef<HTMLDivElement | null>(null)
    const [isLoading, setIsLoading] = useState(false)

    const mediaItems = useMemo(() => {
      const items: MediaItem[] = []
      const urlSet = new Set<string>()

      // Sort events by created_at descending
      const sortedEvents = [...events].sort((a, b) => b.created_at - a.created_at)

      sortedEvents.forEach((evt) => {
        const { images, videos } = extractMediaUrls(evt)

        images.forEach((url) => {
          if (!urlSet.has(url)) {
            urlSet.add(url)
            items.push({
              url,
              type: 'image',
              eventId: evt.id,
              createdAt: evt.created_at
            })
          }
        })

        videos.forEach((url) => {
          if (!urlSet.has(url)) {
            urlSet.add(url)
            items.push({
              url,
              type: 'video',
              eventId: evt.id,
              createdAt: evt.created_at
            })
          }
        })
      })

      return items
    }, [events])

    const lightboxSlides = useMemo(() => {
      return mediaItems.map((item) => {
        if (item.type === 'video') {
          return {
            type: 'video' as const,
            sources: [{ src: item.url, type: 'video/mp4' }]
          }
        }
        return { src: item.url }
      })
    }, [mediaItems])

    const scrollToTop = useCallback((behavior: ScrollBehavior = 'instant') => {
      setTimeout(() => {
        topRef.current?.scrollIntoView({ behavior, block: 'start' })
      }, 20)
    }, [])

    const addEvents = useCallback((newEvents: Event[]) => {
      setEvents((prev) => {
        const eventMap = new Map(prev.map(e => [e.id, e]))
        newEvents.forEach(e => eventMap.set(e.id, e))
        return Array.from(eventMap.values())
      })
    }, [])

    const clearEvents = useCallback(() => {
      setEvents([])
    }, [])

    const refresh = useCallback(() => {
      setEvents([])
      setIsLoading(false)
    }, [])

    useImperativeHandle(ref, () => ({
      scrollToTop,
      addEvents,
      clearEvents,
      refresh
    }), [scrollToTop, addEvents, clearEvents, refresh])

    // Fetch events when subRequests are provided
    useEffect(() => {
      if (!subRequests || subRequests.length === 0) return

      setIsLoading(true)
      const eventMap = new Map<string, Event>()

      const unsubFns = subRequests.map(({ urls, filter }) => {
        return client.subscribe(
          urls,
          filter,
          {
            onevent: (event) => {
              // Only add events that have media
              if (hasMedia(event)) {
                eventMap.set(event.id, event)
                setEvents(Array.from(eventMap.values()))
              }
            },
            oneose: (eosed) => {
              if (eosed) {
                setIsLoading(false)
              }
            }
          }
        )
      })

      return () => {
        unsubFns.forEach(unsub => unsub.close())
      }
    }, [subRequests])

    useEffect(() => {
      if (lightboxIndex >= 0) {
        modalManager.register(lightboxId, () => {
          setLightboxIndex(-1)
        })
      } else {
        modalManager.unregister(lightboxId)
      }
    }, [lightboxIndex, lightboxId])

    const handleMediaClick = (index: number) => {
      setLightboxIndex(index)
    }

    if (isLoading && mediaItems.length === 0) {
      return (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          {t('Loading...')}
        </div>
      )
    }

    if (mediaItems.length === 0) {
      return (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          {t('No media found')}
        </div>
      )
    }

    return (
      <>
        <div ref={topRef} />
        <div className="grid grid-cols-3 gap-1 p-1">
          {mediaItems.map((item, index) => (
            <div
              key={`${item.eventId}-${item.url}-${index}`}
              className="aspect-square relative cursor-pointer group overflow-hidden bg-muted"
              onClick={() => handleMediaClick(index)}
            >
              {item.type === 'image' ? (
                <img
                  src={item.url}
                  alt=""
                  className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
                  loading="lazy"
                />
              ) : (
                <div className="relative w-full h-full">
                  <video
                    src={item.url}
                    className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
                    preload="metadata"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <svg
                      className="w-12 h-12 text-white opacity-80"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        {lightboxIndex >= 0 &&
          createPortal(
            <div onClick={(e) => e.stopPropagation()}>
              <Lightbox
                index={lightboxIndex}
                slides={lightboxSlides}
                plugins={[Zoom, Video]}
                open={lightboxIndex >= 0}
                close={() => setLightboxIndex(-1)}
                controller={{
                  closeOnBackdropClick: true,
                  closeOnPullUp: true,
                  closeOnPullDown: true
                }}
                styles={{
                  toolbar: { paddingTop: '2.25rem' }
                }}
              />
            </div>,
            document.body
          )}
      </>
    )
  }
)

MediaGrid.displayName = 'MediaGrid'

export default MediaGrid
