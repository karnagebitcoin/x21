import { useFetchEvent } from '@/hooks'
import { generateBech32IdFromATag, generateBech32IdFromETag } from '@/lib/tag'
import { useNostr } from '@/providers/NostrProvider'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import NoteCard, { NoteCardLoadingSkeleton } from '../NoteCard'
import { Badge } from '@/components/ui/badge'
import { X, Tag } from 'lucide-react'
import localStorageService from '@/services/local-storage.service'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'


const SHOW_COUNT = 10

export default function BookmarkList() {
  const { t } = useTranslation()
  const { bookmarkListEvent } = useNostr()
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [tagToDelete, setTagToDelete] = useState<string | null>(null)
  const allTags = useMemo(() => localStorageService.getAllBookmarkTags(), [refreshKey])

  const eventIds = useMemo(() => {
    if (!bookmarkListEvent) return []

    return (
      bookmarkListEvent.tags
        .map((tag) =>
          tag[0] === 'e'
            ? generateBech32IdFromETag(tag)
            : tag[0] === 'a'
              ? generateBech32IdFromATag(tag)
              : null
        )
        .filter(Boolean) as (`nevent1${string}` | `naddr1${string}`)[]
    ).reverse()
  }, [bookmarkListEvent])

  const filteredEventIds = useMemo(() => {
    if (!selectedTag) return eventIds

    return eventIds.filter((eventId) => {
      // Extract the actual event ID from the bech32 string
      const tags = localStorageService.getBookmarkTags(eventId)
      return tags.includes(selectedTag)
    })
  }, [eventIds, selectedTag, refreshKey])

  const [showCount, setShowCount] = useState(SHOW_COUNT)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  const handleTagsChange = () => {
    setRefreshKey((prev) => prev + 1)
  }

  const confirmDeleteTag = () => {
    if (tagToDelete) {
      localStorageService.deleteBookmarkTag(tagToDelete)
      if (selectedTag === tagToDelete) {
        setSelectedTag(null)
      }
      setTagToDelete(null)
      handleTagsChange()
    }
  }

  useEffect(() => {
    const options = {
      root: null,
      rootMargin: '10px',
      threshold: 0.1
    }

    const loadMore = () => {
      if (showCount < filteredEventIds.length) {
        setShowCount((prev) => prev + SHOW_COUNT)
      }
    }

    const observerInstance = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
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
  }, [showCount, filteredEventIds])

  if (eventIds.length === 0) {
    return (
      <div className="mt-2 text-sm text-center text-muted-foreground">
        {t('no bookmarks found')}
      </div>
    )
  }

  const tagToDeleteCount = tagToDelete
    ? eventIds.filter((eventId) =>
        localStorageService.getBookmarkTags(eventId).includes(tagToDelete)
      ).length
    : 0

  return (
    <div>
      {/* Delete Tag Confirmation Dialog */}
      <AlertDialog open={!!tagToDelete} onOpenChange={(open) => !open && setTagToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Delete Tag?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('This will remove the tag "{{tag}}" from {{count}} bookmark(s). This action cannot be undone.', {
                tag: tagToDelete,
                count: tagToDeleteCount
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteTag} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t('Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Tag Filter Section */}
      {allTags.length > 0 && (
        <div className="px-4 py-3 border-b border-border space-y-2">
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{t('Filter by tag')}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge
              variant={selectedTag === null ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => setSelectedTag(null)}
            >
              {t('All')} ({eventIds.length})
            </Badge>
            {allTags.map((tag) => {
              const count = eventIds.filter((eventId) =>
                localStorageService.getBookmarkTags(eventId).includes(tag)
              ).length
              return (
                <div key={tag} className="inline-flex">
                  <Badge
                    variant={selectedTag === tag ? 'default' : 'outline'}
                    className="gap-1 pr-1 flex items-center"
                  >
                    <span
                      onClick={() => setSelectedTag(tag)}
                      className="cursor-pointer"
                    >
                      {tag} ({count})
                    </span>
                    <button
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setTagToDelete(tag)
                      }}
                      className="ml-1 hover:bg-destructive/20 rounded-full p-0.5 cursor-pointer transition-colors"
                      title={t('Delete tag from all bookmarks')}
                      type="button"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Bookmarks List */}
      {filteredEventIds.slice(0, showCount).map((eventId) => (
        <BookmarkedNote
          key={eventId}
          eventId={eventId}
          onTagsChange={handleTagsChange}
        />
      ))}

      {showCount < filteredEventIds.length ? (
        <div ref={bottomRef}>
          <NoteCardLoadingSkeleton />
        </div>
      ) : filteredEventIds.length > 0 ? (
        <div className="text-center text-sm text-muted-foreground mt-2">
          {t('no more bookmarks')}
        </div>
      ) : (
        <div className="text-center text-sm text-muted-foreground mt-2 py-12">
          {t('No bookmarks with this tag')}
        </div>
      )}
    </div>
  )
}

function BookmarkedNote({
  eventId,
  onTagsChange
}: {
  eventId: string
  onTagsChange: () => void
}) {
  const { event, isFetching } = useFetchEvent(eventId)

  if (isFetching) {
    return <NoteCardLoadingSkeleton />
  }

  if (!event) {
    return null
  }

  return <NoteCard event={event} className="w-full" onTagsChange={onTagsChange} bookmarkId={eventId} />
}
