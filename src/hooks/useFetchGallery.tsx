import { useEffect, useState } from 'react'
import { TGalleryImageEvent, TGalleryList } from '@/types'
import client from '@/services/client.service'
import galleryService from '@/services/gallery.service'
import { nip19 } from 'nostr-tools'

/**
 * Hook to fetch profile gallery (kind 30001 list + kind 1063 images)
 */
export function useFetchGallery(pubkey?: string, dTag: string = 'gallery') {
  const [isFetching, setIsFetching] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [galleryList, setGalleryList] = useState<TGalleryList | null>(null)
  const [images, setImages] = useState<TGalleryImageEvent[]>([])

  useEffect(() => {
    if (!pubkey) {
      setIsFetching(false)
      setGalleryList(null)
      setImages([])
      return
    }

    const fetchGallery = async () => {
      setIsFetching(true)
      setError(null)

      try {
        // Convert npub to hex if needed
        let hexPubkey = pubkey
        if (pubkey.startsWith('npub1')) {
          try {
            const decoded = nip19.decode(pubkey)
            if (decoded.type === 'npub') {
              hexPubkey = decoded.data
            }
          } catch (err) {
            console.error('[useFetchGallery] Failed to decode npub:', err)
          }
        }

        console.log('[useFetchGallery] Fetching for:', { original: pubkey, hex: hexPubkey, dTag })

        // Fetch the gallery list (kind 30001)
        const listFilter = galleryService.createGalleryListFilter(hexPubkey, dTag)
        const listEvents = await client.fetchEvents([], listFilter)

        console.log('[useFetchGallery] Found list events:', listEvents.length)

        if (listEvents.length === 0) {
          setGalleryList(null)
          setImages([])
          setIsFetching(false)
          return
        }

        // Get the most recent list event
        const latestListEvent = listEvents.sort((a, b) => b.created_at - a.created_at)[0]
        const parsedList = galleryService.parseGalleryListEvent(latestListEvent)

        if (!parsedList || parsedList.imageEventIds.length === 0) {
          setGalleryList(parsedList)
          setImages([])
          setIsFetching(false)
          return
        }

        setGalleryList(parsedList)

        // Fetch the image events (kind 1063)
        const imagesFilter = galleryService.createGalleryImagesFilter(parsedList.imageEventIds)
        const imageEvents = await client.fetchEvents([], imagesFilter)

        // Parse and sort images
        const parsedImages = imageEvents
          .map(event => galleryService.parseGalleryImageEvent(event))
          .filter((img): img is TGalleryImageEvent => img !== null)

        const sortedImages = galleryService.sortGalleryImages(
          parsedImages,
          parsedList.imageEventIds
        )

        setImages(sortedImages)
      } catch (err) {
        console.error('Error fetching gallery:', err)
        setError(err as Error)
      } finally {
        setIsFetching(false)
      }
    }

    fetchGallery()
  }, [pubkey, dTag])

  return { isFetching, error, galleryList, images }
}
