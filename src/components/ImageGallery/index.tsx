import { randomString } from '@/lib/random'
import { cn } from '@/lib/utils'
import { MEDIA_STYLE } from '@/constants'
import { useContentPolicy } from '@/providers/ContentPolicyProvider'
import { useMediaStyle } from '@/providers/MediaStyleProvider'
import modalManager from '@/services/modal-manager.service'
import { TImetaInfo } from '@/types'
import { ReactNode, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import Lightbox from 'yet-another-react-lightbox'
import Zoom from 'yet-another-react-lightbox/plugins/zoom'
import Image from '../Image'

// Calculate aspect ratio string from dimensions, with fallback
function getAspectRatio(dim?: { width: number; height: number }): string | undefined {
  if (!dim || !dim.width || !dim.height) return undefined
  return `${dim.width} / ${dim.height}`
}

export default function ImageGallery({
  className,
  images,
  start = 0,
  end = images.length,
  mustLoad = false,
  compactMedia = false,
  isSingleMedia = false
}: {
  className?: string
  images: TImetaInfo[]
  start?: number
  end?: number
  mustLoad?: boolean
  compactMedia?: boolean
  isSingleMedia?: boolean
}) {
  const id = useMemo(() => `image-gallery-${randomString()}`, [])
  const { t } = useTranslation()
  const { autoLoadMedia, shouldAutoLoadMedia } = useContentPolicy()
  const { mediaStyle } = useMediaStyle()
  const [index, setIndex] = useState(-1)
  const [loadedImages, setLoadedImages] = useState<Set<number>>(() => {
    const loaded = new Set<number>()
    images.forEach((img, idx) => {
      if (shouldAutoLoadMedia(img.pubkey)) {
        loaded.add(idx)
      }
    })
    return loaded
  })
  const displayImages = images.slice(start, end)
  const isFullWidth = mediaStyle === MEDIA_STYLE.FULL_WIDTH && isSingleMedia && displayImages.length <= 2

  useEffect(() => {
    if (index >= 0) {
      modalManager.register(id, () => {
        setIndex(-1)
      })
    } else {
      modalManager.unregister(id)
    }
  }, [index, id])

  const handlePhotoClick = (event: React.MouseEvent, current: number) => {
    event.stopPropagation()
    event.preventDefault()
    const actualIndex = start + current
    // Mark this image as loaded
    setLoadedImages(prev => new Set(prev).add(actualIndex))
    setIndex(actualIndex)
  }

  const handleLoadImage = (event: React.MouseEvent, imageIndex: number) => {
    event.stopPropagation()
    event.preventDefault()
    setLoadedImages(prev => new Set(prev).add(imageIndex))
  }

  if (!mustLoad && !autoLoadMedia) {
    let imageContent: ReactNode | null = null

    // For compact media
    if (compactMedia) {
      imageContent = (
        <div className="flex flex-wrap gap-2">
          {displayImages.map((image, i) => {
            const actualIndex = start + i
            const isLoaded = loadedImages.has(actualIndex)

            if (!isLoaded) {
              return (
                <div
                  key={i}
                  className="w-20 h-20 border rounded flex items-center justify-center text-xs text-primary hover:bg-accent cursor-pointer"
                  onClick={(e) => handleLoadImage(e, actualIndex)}
                >
                  [{t('Load')}]
                </div>
              )
            }

            return (
              <Image
                key={i}
                className="w-20 h-20 cursor-zoom-in object-cover"
                classNames={{
                  errorPlaceholder: 'w-20 h-20'
                }}
                image={image}
                onClick={(e) => handlePhotoClick(e, i)}
              />
            )
          })}
        </div>
      )
    }
    // For single images
    else if (displayImages.length === 1) {
      const actualIndex = start
      const isLoaded = loadedImages.has(actualIndex)
      const aspectRatio = getAspectRatio(displayImages[0].dim)

      if (!isLoaded) {
        imageContent = (
          <div
            className="text-primary hover:underline truncate w-fit cursor-pointer"
            onClick={(e) => handleLoadImage(e, actualIndex)}
          >
            [{t('Click to load image')}]
          </div>
        )
      } else {
        imageContent = (
          <Image
            key={0}
            className={cn(
              'cursor-zoom-in w-full',
              isFullWidth ? 'h-auto object-contain' : 'max-h-[80vh] sm:max-h-[50vh] object-contain'
            )}
            classNames={{
              errorPlaceholder: 'aspect-square h-[30vh]',
              wrapper: isFullWidth ? 'w-full' : 'w-fit max-w-full'
            }}
            style={{
              borderRadius: 'var(--media-radius, 12px)',
              // Reserve space with aspect-ratio when dimensions are known (non-fullwidth only)
              ...(!isFullWidth && aspectRatio ? { aspectRatio } : {})
            }}
            image={displayImages[0]}
            onClick={(e) => handlePhotoClick(e, 0)}
          />
        )
      }
    }
    // For 2 images
    else if (displayImages.length === 2) {
      imageContent = (
        <div className="grid grid-cols-2 gap-2 w-full">
          {displayImages.map((image, i) => {
            const actualIndex = start + i
            const isLoaded = loadedImages.has(actualIndex)

            if (!isLoaded) {
              return (
                <div
                  key={i}
                  className="aspect-square border rounded flex items-center justify-center text-sm text-primary hover:bg-accent cursor-pointer"
                  onClick={(e) => handleLoadImage(e, actualIndex)}
                >
                  [{t('Load')}]
                </div>
              )
            }

            return (
              <Image
                key={i}
                className={cn(
                  "w-full cursor-zoom-in",
                  isFullWidth ? "h-auto object-contain" : "aspect-square object-cover"
                )}
                classNames={{
                  errorPlaceholder: 'aspect-square h-[30vh]'
                }}
                style={{
                  borderRadius: 'var(--media-radius, 12px)'
                }}
                image={image}
                onClick={(e) => handlePhotoClick(e, i)}
              />
            )
          })}
        </div>
      )
    }
    // For 4 images
    else if (displayImages.length === 4) {
      imageContent = (
        <div className="grid grid-cols-2 gap-2 w-full">
          {displayImages.map((image, i) => {
            const actualIndex = start + i
            const isLoaded = loadedImages.has(actualIndex)

            if (!isLoaded) {
              return (
                <div
                  key={i}
                  className="aspect-square border rounded flex items-center justify-center text-sm text-primary hover:bg-accent cursor-pointer"
                  onClick={(e) => handleLoadImage(e, actualIndex)}
                >
                  [{t('Load')}]
                </div>
              )
            }

            return (
              <Image
                key={i}
                className="aspect-square w-full cursor-zoom-in object-cover"
                classNames={{
                  errorPlaceholder: 'aspect-square h-[30vh]'
                }}
                style={{
                  borderRadius: 'var(--media-radius, 12px)'
                }}
                image={image}
                onClick={(e) => handlePhotoClick(e, i)}
              />
            )
          })}
        </div>
      )
    }
    // For 3+ images
    else {
      imageContent = (
        <div className="grid grid-cols-3 gap-2 w-full">
          {displayImages.map((image, i) => {
            const actualIndex = start + i
            const isLoaded = loadedImages.has(actualIndex)

            if (!isLoaded) {
              return (
                <div
                  key={i}
                  className="aspect-square border rounded flex items-center justify-center text-xs text-primary hover:bg-accent cursor-pointer"
                  onClick={(e) => handleLoadImage(e, actualIndex)}
                >
                  [{t('Load')}]
                </div>
              )
            }

            return (
              <Image
                key={i}
                className="aspect-square w-full cursor-zoom-in object-cover"
                classNames={{
                  errorPlaceholder: 'aspect-square h-[30vh]'
                }}
                style={{
                  borderRadius: 'var(--media-radius, 12px)'
                }}
                image={image}
                onClick={(e) => handlePhotoClick(e, i)}
              />
            )
          })}
        </div>
      )
    }

    return (
      <div className={cn(
        compactMedia
          ? 'w-full'
          : displayImages.length === 1
            ? (isFullWidth ? 'w-full' : 'w-fit max-w-full')
            : 'w-full',
        className
      )}>
        {imageContent}
        {index >= 0 &&
          createPortal(
            <div onClick={(e) => e.stopPropagation()}>
              <Lightbox
                index={index}
                slides={images.map(({ url, alt }) => ({ src: url, alt: alt || '' }))}
                plugins={[Zoom]}
                open={index >= 0}
                close={() => setIndex(-1)}
                on={{
                  view: ({ index: currentIndex }) => setIndex(currentIndex)
                }}
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
      </div>
    )
  }

  let imageContent: ReactNode | null = null
  if (compactMedia) {
    imageContent = (
      <div className="flex flex-wrap gap-2">
        {displayImages.map((image, i) => (
          <Image
            key={i}
            className="w-20 h-20 cursor-zoom-in object-cover"
            classNames={{
              errorPlaceholder: 'w-20 h-20'
            }}
            image={image}
            onClick={(e) => handlePhotoClick(e, i)}
          />
        ))}
      </div>
    )
  } else if (displayImages.length === 1) {
    const aspectRatio = getAspectRatio(displayImages[0].dim)
    imageContent = (
      <Image
        key={0}
        className={cn(
          'cursor-zoom-in w-full',
          isFullWidth ? 'h-auto object-contain' : 'max-h-[80vh] sm:max-h-[50vh] object-contain'
        )}
        classNames={{
          errorPlaceholder: 'aspect-square h-[30vh]',
          wrapper: isFullWidth ? 'w-full' : 'w-fit max-w-full'
        }}
        style={{
          borderRadius: 'var(--media-radius, 12px)',
          // Reserve space with aspect-ratio when dimensions are known (non-fullwidth only)
          ...(!isFullWidth && aspectRatio ? { aspectRatio } : {})
        }}
        image={displayImages[0]}
        onClick={(e) => handlePhotoClick(e, 0)}
      />
    )
  } else if (displayImages.length === 2) {
    imageContent = (
      <div className="grid grid-cols-2 gap-2 w-full">
        {displayImages.map((image, i) => (
          <Image
            key={i}
            className={cn(
              "w-full cursor-zoom-in",
              isFullWidth ? "h-auto object-contain" : "aspect-square object-cover"
            )}
            classNames={{
              errorPlaceholder: 'aspect-square h-[30vh]'
            }}
            style={{
              borderRadius: 'var(--media-radius, 12px)'
            }}
            image={image}
            onClick={(e) => handlePhotoClick(e, i)}
          />
        ))}
      </div>
    )
  } else if (displayImages.length === 4) {
    imageContent = (
      <div className="grid grid-cols-2 gap-2 w-full">
        {displayImages.map((image, i) => (
          <Image
            key={i}
            className="aspect-square w-full cursor-zoom-in object-cover"
            classNames={{
              errorPlaceholder: 'aspect-square h-[30vh]'
            }}
            style={{
              borderRadius: 'var(--media-radius, 12px)'
            }}
            image={image}
            onClick={(e) => handlePhotoClick(e, i)}
          />
        ))}
      </div>
    )
  } else {
    imageContent = (
      <div className="grid grid-cols-3 gap-2 w-full">
        {displayImages.map((image, i) => (
          <Image
            key={i}
            className="aspect-square w-full cursor-zoom-in object-cover"
            classNames={{
              errorPlaceholder: 'aspect-square h-[30vh]'
            }}
            style={{
              borderRadius: 'var(--media-radius, 12px)'
            }}
            image={image}
            onClick={(e) => handlePhotoClick(e, i)}
          />
        ))}
      </div>
    )
  }

  return (
    <div className={cn(
      compactMedia
        ? 'w-full'
        : displayImages.length === 1
          ? (isFullWidth ? 'w-full' : 'w-fit max-w-full')
          : 'w-full',
      className
    )}>
      {imageContent}
      {index >= 0 &&
        createPortal(
          <div onClick={(e) => e.stopPropagation()}>
            <Lightbox
              index={index}
              slides={images.map(({ url, alt }) => ({ src: url, alt: alt || '' }))}
              plugins={[Zoom]}
              open={index >= 0}
              close={() => setIndex(-1)}
              on={{
                view: ({ index: currentIndex }) => setIndex(currentIndex)
              }}
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
    </div>
  )
}
