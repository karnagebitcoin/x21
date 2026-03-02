import { useState, useMemo, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { X, Plus, Tag, Tags } from 'lucide-react'
import localStorageService from '@/services/local-storage.service'
import { useTranslation } from 'react-i18next'
import { useNostr } from '@/providers/NostrProvider'
import { Event } from 'nostr-tools'
import { getReplaceableCoordinateFromEvent, isReplaceableEvent } from '@/lib/event'

interface BookmarkTagManagerProps {
  event: Event
  onTagsChange?: () => void
  bookmarkId?: string
}

export default function BookmarkTagManager({ event, onTagsChange, bookmarkId }: BookmarkTagManagerProps) {
  const { t } = useTranslation()
  const { bookmarkListEvent } = useNostr()

  // Use bookmarkId if provided (from bookmark list), otherwise use event?.id
  const storageKey = bookmarkId || event?.id || ''
  const [open, setOpen] = useState(false)
  const [tags, setTags] = useState<string[]>(localStorageService.getBookmarkTags(storageKey))
  const [newTag, setNewTag] = useState('')

  // Check if this note is bookmarked
  const isBookmarked = useMemo(() => {
    if (!event) return false

    const isReplaceable = isReplaceableEvent(event.kind)
    const eventKey = isReplaceable ? getReplaceableCoordinateFromEvent(event) : event.id

    return bookmarkListEvent?.tags.some((tag) =>
      isReplaceable ? tag[0] === 'a' && tag[1] === eventKey : tag[0] === 'e' && tag[1] === eventKey
    )
  }, [bookmarkListEvent, event])

  // Update tags when storage key changes or dialog opens
  useEffect(() => {
    if (open && storageKey) {
      setTags(localStorageService.getBookmarkTags(storageKey))
    }
  }, [storageKey, open])

  // Don't render if not bookmarked or event doesn't exist
  if (!isBookmarked || !event) return null

  const handleAddTag = () => {
    const trimmedTag = newTag.trim()
    if (trimmedTag && !tags.includes(trimmedTag)) {
      const updatedTags = [...tags, trimmedTag]
      setTags(updatedTags)
      localStorageService.setBookmarkTags(storageKey, updatedTags)
      setNewTag('')
      onTagsChange?.()
    }
  }

  const handleRemoveTag = (tag: string) => {
    const updatedTags = tags.filter((t) => t !== tag)
    setTags(updatedTags)
    localStorageService.setBookmarkTags(storageKey, updatedTags)
    onTagsChange?.()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddTag()
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={tags.length > 0 ? 'text-primary' : ''}
        >
          {tags.length > 0 ? (
            <Tags className="h-4 w-4" />
          ) : (
            <Tag className="h-4 w-4" />
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('Manage Tags')}</DialogTitle>
          <DialogDescription>
            {t('Add tags to organize your bookmarks')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder={t('Add a tag...')}
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <Button onClick={handleAddTag} size="sm">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {tags.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('No tags yet')}</p>
            ) : (
              tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="gap-1">
                  {tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="ml-1 hover:bg-accent rounded-full"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
