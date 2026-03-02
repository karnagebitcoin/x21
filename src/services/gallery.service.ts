import { ExtendedKind } from '@/constants'
import { Event, Filter } from 'nostr-tools'
import { TGalleryImageEvent, TGalleryList } from '@/types'
import { tagNameEquals } from '@/lib/tag'

/**
 * Service for managing NIP-94 based profile galleries
 * Uses kind 1063 (file metadata) for individual images
 * and kind 30001 (bookmark sets) to organize them
 */
class GalleryService {
  private static instance: GalleryService

  private constructor() {}

  public static getInstance(): GalleryService {
    if (!GalleryService.instance) {
      GalleryService.instance = new GalleryService()
    }
    return GalleryService.instance
  }

  /**
   * Convert kind 1063 event to TGalleryImageEvent
   */
  parseGalleryImageEvent(event: Event): TGalleryImageEvent | null {
    try {
      const urlTag = event.tags.find(tagNameEquals('url'))
      if (!urlTag || !urlTag[1]) return null

      const mimeTypeTag = event.tags.find(tagNameEquals('m'))
      const hashTag = event.tags.find(tagNameEquals('x'))
      const sizeTag = event.tags.find(tagNameEquals('size'))
      const dimTag = event.tags.find(tagNameEquals('dim'))
      const altTag = event.tags.find(tagNameEquals('alt'))
      const blurhashTag = event.tags.find(tagNameEquals('blurhash'))
      const thumbTag = event.tags.find(tagNameEquals('thumb'))
      const linkTag = event.tags.find(tagNameEquals('r'))

      return {
        id: event.id,
        pubkey: event.pubkey,
        created_at: event.created_at,
        url: urlTag[1],
        description: event.content || undefined,
        link: linkTag?.[1],
        mimeType: mimeTypeTag?.[1],
        hash: hashTag?.[1],
        size: sizeTag?.[1] ? parseInt(sizeTag[1], 10) : undefined,
        dimensions: dimTag?.[1],
        alt: altTag?.[1],
        blurhash: blurhashTag?.[1],
        thumb: thumbTag?.[1]
      }
    } catch (err) {
      console.error('Error parsing gallery image event:', err)
      return null
    }
  }

  /**
   * Convert kind 30001 event to TGalleryList
   */
  parseGalleryListEvent(event: Event): TGalleryList | null {
    try {
      const dTag = event.tags.find(tagNameEquals('d'))?.[1]
      if (!dTag) return null

      const titleTag = event.tags.find(tagNameEquals('title'))
      const imageEventIds = event.tags
        .filter(tagNameEquals('e'))
        .map(tag => tag[1])
        .filter(Boolean)

      return {
        id: event.id,
        pubkey: event.pubkey,
        created_at: event.created_at,
        dTag,
        title: titleTag?.[1],
        imageEventIds
      }
    } catch (err) {
      console.error('Error parsing gallery list event:', err)
      return null
    }
  }

  /**
   * Create filter to fetch gallery list for a pubkey
   */
  createGalleryListFilter(pubkey: string, dTag: string = 'gallery'): Filter {
    return {
      kinds: [ExtendedKind.BOOKMARK_SET],
      authors: [pubkey],
      '#d': [dTag],
      limit: 1
    }
  }

  /**
   * Create filter to fetch gallery image events
   */
  createGalleryImagesFilter(eventIds: string[]): Filter {
    return {
      kinds: [ExtendedKind.FILE_METADATA],
      ids: eventIds
    }
  }

  /**
   * Create filter to fetch all gallery images by a pubkey
   * (images marked with gallery tag)
   */
  createUserGalleryImagesFilter(pubkey: string, limit: number = 100): Filter {
    return {
      kinds: [ExtendedKind.FILE_METADATA],
      authors: [pubkey],
      '#t': ['gallery', 'profile-gallery'],
      limit
    }
  }

  /**
   * Check if an event is a gallery image
   */
  isGalleryImage(event: Event): boolean {
    return (
      event.kind === ExtendedKind.FILE_METADATA &&
      event.tags.some(tag => 
        tagNameEquals('t')(tag) && 
        (tag[1] === 'gallery' || tag[1] === 'profile-gallery')
      )
    )
  }

  /**
   * Get image event IDs from gallery list, maintaining order
   */
  getImageEventIds(galleryList: TGalleryList): string[] {
    return galleryList.imageEventIds
  }

  /**
   * Sort gallery images by their order in the gallery list
   */
  sortGalleryImages(
    images: TGalleryImageEvent[],
    orderedIds: string[]
  ): TGalleryImageEvent[] {
    const imageMap = new Map(images.map(img => [img.id, img]))
    const sorted: TGalleryImageEvent[] = []

    // Add images in the order specified by orderedIds
    for (const id of orderedIds) {
      const image = imageMap.get(id)
      if (image) {
        sorted.push(image)
        imageMap.delete(id)
      }
    }

    // Add any remaining images that weren't in orderedIds
    // (shouldn't happen, but just in case)
    imageMap.forEach(image => sorted.push(image))

    return sorted
  }
}

const galleryService = GalleryService.getInstance()
export default galleryService
