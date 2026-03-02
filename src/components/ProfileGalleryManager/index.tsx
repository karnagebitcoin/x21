import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import Uploader from '@/components/PostEditor/Uploader'
import { TGalleryImageEvent } from '@/types'
import { ExternalLink, Loader, Trash2, ImagePlus } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { useNostr } from '@/providers/NostrProvider'
import { createGalleryImageDraftEvent, createGalleryListDraftEvent } from '@/lib/draft-event'
import { useFetchGallery } from '@/hooks/useFetchGallery'
import { toast } from 'sonner'

interface ProfileGalleryManagerProps {
  onChange: (imageEventIds: string[]) => void
}

export default function ProfileGalleryManager({ onChange }: ProfileGalleryManagerProps) {
  const { t } = useTranslation()
  const { account, publish } = useNostr()
  const { isFetching, images: galleryImages, galleryList } = useFetchGallery(account?.pubkey)

  const [localImages, setLocalImages] = useState<TGalleryImageEvent[]>([])
  const [editingImage, setEditingImage] = useState<TGalleryImageEvent | null>(null)
  const [uploadingCount, setUploadingCount] = useState(0)
  const [publishingImage, setPublishingImage] = useState<string | null>(null)
  const isInitialized = useRef(false)

  // Sync local state with fetched gallery
  useEffect(() => {
    if (!isFetching) {
      setLocalImages(galleryImages)
      isInitialized.current = true
      console.log('[ProfileGalleryManager] Initialized with gallery images:', galleryImages.length)
    }
  }, [isFetching, galleryImages])

  // Notify parent of image event IDs whenever local images change
  useEffect(() => {
    onChange(localImages.map(img => img.id))
  }, [localImages, onChange])

  // Auto-publish gallery list whenever local images change (after initialization)
  useEffect(() => {
    console.log('[ProfileGalleryManager] useEffect triggered:', {
      hasAccount: !!account,
      isInitialized: isInitialized.current,
      localImagesCount: localImages.length,
      hasGalleryList: !!galleryList
    })

    if (!account || !isInitialized.current) {
      console.log('[ProfileGalleryManager] Skipping auto-publish')
      return
    }

    const publishGalleryList = async () => {
      try {
        const imageEventIds = localImages.map(img => img.id)

        console.log('[ProfileGalleryManager] Preparing to publish gallery list:', {
          imageEventIdsCount: imageEventIds.length,
          imageEventIds,
          hasGalleryList: !!galleryList
        })

        // Only publish if there are images or if we're clearing an existing gallery
        if (imageEventIds.length > 0 || galleryList) {
          const galleryListDraftEvent = createGalleryListDraftEvent({
            imageEventIds,
            dTag: 'gallery',
            title: 'Profile Gallery',
            previousEvent: galleryList ? {
              id: galleryList.id,
              pubkey: galleryList.pubkey,
              created_at: galleryList.created_at,
              kind: 30001,
              tags: [
                ['d', galleryList.dTag],
                ...(galleryList.title ? [['title', galleryList.title]] : []),
                ...galleryList.imageEventIds.map(id => ['e', id])
              ],
              content: '',
              sig: ''
            } : undefined
          })

          console.log('[ProfileGalleryManager] Publishing gallery list event:', galleryListDraftEvent)
          const result = await publish(galleryListDraftEvent)
          console.log('[ProfileGalleryManager] Gallery list published successfully:', result)
        } else {
          console.log('[ProfileGalleryManager] Skipping publish - no images and no existing gallery list')
        }
      } catch (err) {
        console.error('[ProfileGalleryManager] Failed to auto-publish gallery list:', err)
        // Don't show error toast for auto-publish failures
      }
    }

    publishGalleryList()
  }, [localImages, account, publish, galleryList])

  const handleUploadSuccess = async ({ url }: { url: string }) => {
    if (!account) return

    try {
      setPublishingImage(url)

      // Create and publish kind 1063 event for the image
      const draftEvent = createGalleryImageDraftEvent({
        url,
        mimeType: 'image/jpeg', // TODO: detect from file
        alt: 'Gallery image'
      })

      const publishedEvent = await publish(draftEvent)

      // Parse into TGalleryImageEvent
      const newImage: TGalleryImageEvent = {
        id: publishedEvent.id,
        pubkey: publishedEvent.pubkey,
        created_at: publishedEvent.created_at,
        url,
        description: publishedEvent.content || undefined
      }

      // Add to local state
      setLocalImages(prev => [...prev, newImage])

      toast.success(t('Image added to gallery'))
    } catch (err) {
      console.error('Failed to publish gallery image:', err)
      toast.error(t('Failed to add image to gallery'))
    } finally {
      setPublishingImage(null)
    }
  }

  const handleRemoveImage = (imageToRemove: TGalleryImageEvent) => {
    setLocalImages(prev => prev.filter(img => img.id !== imageToRemove.id))
    toast.success(t('Image removed from gallery'))
    // Note: The kind 30001 gallery list update happens automatically via useEffect
  }

  const handleEditImage = (image: TGalleryImageEvent) => {
    setEditingImage({ ...image })
  }

  const normalizeUrl = (url: string): string => {
    if (!url) return ''
    const trimmed = url.trim()
    if (!trimmed) return ''

    // If it already has a protocol, return as-is
    if (trimmed.match(/^https?:\/\//i)) {
      return trimmed
    }

    // Add https:// prefix
    return `https://${trimmed}`
  }

  const handleSaveEdit = async () => {
    if (!editingImage || !account) return

    try {
      // Publish a new kind 1063 event with updated metadata
      const normalizedLink = editingImage.link ? normalizeUrl(editingImage.link) : undefined

      const draftEvent = createGalleryImageDraftEvent({
        url: editingImage.url,
        description: editingImage.description,
        link: normalizedLink,
        mimeType: editingImage.mimeType,
        hash: editingImage.hash,
        size: editingImage.size,
        dimensions: editingImage.dimensions,
        alt: editingImage.alt,
        blurhash: editingImage.blurhash,
        thumb: editingImage.thumb
      })

      const publishedEvent = await publish(draftEvent)

      // Update local state with new event
      const updatedImage: TGalleryImageEvent = {
        ...editingImage,
        id: publishedEvent.id,
        created_at: publishedEvent.created_at,
        link: normalizedLink
      }

      setLocalImages(prev =>
        prev.map(img => img.id === editingImage.id ? updatedImage : img)
      )

      toast.success(t('Image updated'))
      setEditingImage(null)
    } catch (err) {
      console.error('Failed to update gallery image:', err)
      toast.error(t('Failed to update image'))
    }
  }

  const handleCancelEdit = () => {
    setEditingImage(null)
  }

  const handleUploadStart = (file: File) => {
    setUploadingCount(prev => prev + 1)
  }

  const handleUploadEnd = (file: File) => {
    setUploadingCount(prev => prev - 1)
  }

  if (!account) {
    return null
  }

  return (
    <div className="grid gap-4">
      <div>
        <Label>{t('Profile Gallery')}</Label>
        <p className="text-xs text-muted-foreground mt-1">
          {t(
            'Add images to your profile gallery. Each image is a separate event that can be reacted to and commented on.'
          )}
        </p>
      </div>

      {/* Upload Area - Full Width */}
      <Uploader
        onUploadSuccess={handleUploadSuccess}
        onUploadStart={handleUploadStart}
        onUploadEnd={handleUploadEnd}
        className={cn(
          'border-2 border-dashed border-muted-foreground/25 rounded-lg',
          'hover:border-muted-foreground/50 transition-colors cursor-pointer',
          'bg-muted/20 hover:bg-muted/40'
        )}
      >
        <div className="flex flex-col items-center justify-center p-8 text-muted-foreground">
          {uploadingCount > 0 || publishingImage ? (
            <>
              <Loader className="w-10 h-10 animate-spin mb-3" />
              <p className="text-sm">
                {publishingImage
                  ? t('Publishing image event...')
                  : `${t('Uploading')} ${uploadingCount} ${uploadingCount === 1 ? t('image') : t('images')}...`}
              </p>
            </>
          ) : (
            <>
              <ImagePlus className="w-10 h-10 mb-3" />
              <p className="text-base font-medium mb-1">{t('Upload Images')}</p>
              <p className="text-sm text-center">
                {t('Click to select or drag and drop')}
                <br />
                <span className="text-xs">{t('Each image becomes its own event')}</span>
              </p>
            </>
          )}
        </div>
      </Uploader>

      {/* Loading state */}
      {isFetching && (
        <div className="flex items-center justify-center p-8">
          <Loader className="w-6 h-6 animate-spin" />
        </div>
      )}

      {/* Gallery Grid */}
      {!isFetching && localImages.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {localImages.map((image) => (
            <div
              key={image.id}
              className="relative aspect-square overflow-hidden group bg-muted"
              style={{ borderRadius: 'var(--media-radius, 12px)' }}
            >
              <img
                src={image.url}
                alt={image.description || 'Gallery image'}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              <div
                className={cn(
                  'absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100',
                  'transition-opacity flex items-center justify-center gap-2'
                )}
              >
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-8"
                  onClick={() => handleEditImage(image)}
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-8"
                  onClick={() => handleRemoveImage(image)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              {image.description && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                  <p className="text-white text-xs line-clamp-2">{image.description}</p>
                </div>
              )}
              {image.link && (
                <div className="absolute top-2 right-2 bg-white/80 backdrop-blur-sm p-1 rounded">
                  <ExternalLink className="w-3 h-3" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editingImage !== null} onOpenChange={(open) => !open && handleCancelEdit()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('Edit Gallery Image')}</DialogTitle>
            <DialogDescription>
              {t('Update the description and optional link. This will publish a new event.')}
            </DialogDescription>
          </DialogHeader>
          {editingImage && (
            <div className="grid gap-4 py-4">
              <div className="aspect-square w-full overflow-hidden bg-muted" style={{ borderRadius: 'var(--media-radius, 12px)' }}>
                <img
                  src={editingImage.url}
                  alt="Preview"
                  className="w-full h-full object-cover"
                  style={{ borderRadius: 'var(--media-radius, 12px)' }}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="gallery-description">{t('Description (optional)')}</Label>
                <Textarea
                  id="gallery-description"
                  placeholder={t('Describe this image...')}
                  value={editingImage.description || ''}
                  onChange={(e) =>
                    setEditingImage({ ...editingImage, description: e.target.value })
                  }
                  className="h-24"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="gallery-link">{t('Link (optional)')}</Label>
                <Input
                  id="gallery-link"
                  type="url"
                  placeholder={t('https://example.com')}
                  value={editingImage.link || ''}
                  onChange={(e) => {
                    setEditingImage({ ...editingImage, link: e.target.value })
                  }}
                />
                {editingImage.link && (
                  <p className="text-xs text-muted-foreground">
                    Will be saved as: {normalizeUrl(editingImage.link)}
                  </p>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelEdit}>
              {t('Cancel')}
            </Button>
            <Button onClick={handleSaveEdit}>{t('Save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
