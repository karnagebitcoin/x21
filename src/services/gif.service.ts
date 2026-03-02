import client from './client.service'
import indexedDbService from './indexed-db.service'
import { Event, Filter } from 'nostr-tools'

// Relays that may have GIF/file metadata events
// gifbuddy.lol is the primary source with 25k+ GIFs
const GIF_RELAYS = [
  'wss://relay.gifbuddy.lol'
]
const BATCH_SIZE = 100 // Batch size for IndexedDB operations

export interface GifEvent extends Event {
  kind: 1063
}

export interface GifData {
  url: string
  previewUrl?: string
  alt?: string
  size?: string
  hash?: string
  eventId?: string
  createdAt?: number
  pubkey?: string
}

export interface GifSearchResult {
  gifs: GifData[]
  hasMore: boolean
}

interface GifSearchCache {
  [query: string]: {
    gifs: GifData[]
    timestamp: number
  }
}

class GifService {
  private allGifsCache: Map<string, GifData> = new Map() // eventId -> GifData
  private searchCache: GifSearchCache = {}
  private isInitialized = false
  private initializationPromise: Promise<void> | null = null
  private updateCallbacks: Set<() => void> = new Set()

  private gifEventToData(event: GifEvent): GifData | null {
    const urlTag = event.tags.find((tag) => tag[0] === 'url')
    if (!urlTag || !urlTag[1]) return null

    const url = urlTag[1]
    const mimeType = event.tags.find((tag) => tag[0] === 'm')?.[1]

    // Only accept actual GIFs
    if (mimeType) {
      if (!mimeType.includes('gif')) return null
    } else {
      // No MIME type - check URL extension
      const urlLower = url.toLowerCase()
      if (!urlLower.endsWith('.gif')) return null
    }

    const thumbTag = event.tags.find((tag) => tag[0] === 'thumb')
    const imageTag = event.tags.find((tag) => tag[0] === 'image')
    const altTag = event.tags.find((tag) => tag[0] === 'alt')
    const sizeTag = event.tags.find((tag) => tag[0] === 'size')
    const hashTag = event.tags.find((tag) => tag[0] === 'x')

    return {
      url,
      previewUrl: thumbTag?.[1] || imageTag?.[1] || url,
      alt: altTag?.[1] || event.content,
      size: sizeTag?.[1],
      hash: hashTag?.[1],
      eventId: event.id,
      createdAt: event.created_at,
      pubkey: event.pubkey
    }
  }

  private async loadCacheFromStorage(): Promise<void> {
    try {
      const gifs = await indexedDbService.getAllGifs()
      gifs.forEach((gif) => {
        if (gif.eventId) {
          this.allGifsCache.set(gif.eventId, gif)
        }
      })
    } catch (error) {
      console.error('[GifService] Error loading cache from IndexedDB:', error)
    }
  }

  private async saveCacheToStorage(): Promise<void> {
    try {
      // Get all new GIFs that need to be saved
      const gifsToSave = Array.from(this.allGifsCache.values())

      if (gifsToSave.length === 0) return

      // Save in batches to avoid blocking
      for (let i = 0; i < gifsToSave.length; i += BATCH_SIZE) {
        const batch = gifsToSave.slice(i, i + BATCH_SIZE)
        await indexedDbService.putManyGifs(batch)
      }
    } catch (error) {
      console.error('[GifService] Error saving cache to IndexedDB:', error)
    }
  }

  private async initialize(): Promise<void> {
    if (this.isInitialized) return
    if (this.initializationPromise) return this.initializationPromise

    this.initializationPromise = (async () => {
      // Load cache from IndexedDB
      await this.loadCacheFromStorage()

      this.isInitialized = true

      // Start fetching immediately - don't wait for cache to be big enough
      // This ensures we get fresh GIFs even on first load
      this.backgroundFetchGifs()
    })()

    return this.initializationPromise
  }

  private async backgroundFetchGifs(): Promise<void> {
    try {
      // First fetch - get a good initial batch immediately
      let result = await this.fetchAndCacheGifs(2000)

      // Continue fetching more batches
      let batchNumber = 2
      const batchSize = 2000
      const maxBatches = 50 // Increase to 50 batches to get more GIFs
      let consecutiveEmptyBatches = 0

      while (batchNumber <= maxBatches) {
        // Small delay between batches to not overwhelm the relay
        await new Promise(resolve => setTimeout(resolve, 1000))

        result = await this.fetchAndCacheGifs(batchSize)
        batchNumber++

        // Track consecutive batches with no events
        if (result.totalEvents === 0) {
          consecutiveEmptyBatches++
          if (consecutiveEmptyBatches >= 3) {
            break
          }
        } else {
          consecutiveEmptyBatches = 0
        }

        // Stop if we got absolutely no events at all
        if (result.totalEvents === 0 && batchNumber > 5) {
          break
        }
      }
    } catch (error) {
      console.error('[GifService] Background fetch error:', error)
    }
  }

  private async fetchAndCacheGifs(limit: number = 2000): Promise<{ newGifs: number; totalEvents: number }> {
    try {
      // Build filter - if we have cached GIFs, fetch older ones
      const filter: Filter = {
        kinds: [1063],
        limit
      }

      // If we have cached GIFs, fetch older ones using 'until'
      if (this.allGifsCache.size > 0) {
        const cachedGifs = Array.from(this.allGifsCache.values())
        const oldestCached = cachedGifs.reduce((oldest, gif) =>
          (gif.createdAt || 0) < (oldest.createdAt || 0) ? gif : oldest
        )
        if (oldestCached.createdAt) {
          filter.until = oldestCached.createdAt - 1
        }
      }

      const events = await client.pool.querySync(GIF_RELAYS, filter) as GifEvent[]

      let newGifsCount = 0
      let filteredOut = 0
      events.forEach((event) => {
        const gifData = this.gifEventToData(event)
        if (gifData) {
          if (gifData.eventId && !this.allGifsCache.has(gifData.eventId)) {
            this.allGifsCache.set(gifData.eventId, gifData)
            newGifsCount++
          }
        } else {
          filteredOut++
        }
      })

      // Save to localStorage and notify subscribers if we got new GIFs
      if (newGifsCount > 0) {
        this.saveCacheToStorage()
        this.notifyCacheUpdate()
      }

      return {
        newGifs: newGifsCount,
        totalEvents: events.length
      }
    } catch (error) {
      console.error('[GifService] Error fetching GIFs:', error)
      return { newGifs: 0, totalEvents: 0 }
    }
  }

  async fetchRecentGifs(limit: number = 24, offset: number = 0): Promise<GifSearchResult> {
    await this.initialize()

    // Get all GIFs sorted by created_at (most recent first)
    const sortedGifs = Array.from(this.allGifsCache.values())
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))

    const gifs = sortedGifs.slice(offset, offset + limit)
    const hasMore = offset + limit < sortedGifs.length

    return {
      gifs,
      hasMore
    }
  }

  async searchGifs(query: string, limit: number = 24, offset: number = 0, filterByPubkey?: string): Promise<GifSearchResult> {
    if (!query.trim()) {
      return filterByPubkey
        ? this.fetchMyGifs(filterByPubkey, limit, offset)
        : this.fetchRecentGifs(limit, offset)
    }

    await this.initialize()

    const lowerQuery = query.toLowerCase()
    const cacheKey = filterByPubkey ? `${query}:${filterByPubkey}` : query

    // Check if we have a recent search cache
    const cached = this.searchCache[cacheKey]
    if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) { // 5 minutes
      const gifs = cached.gifs.slice(offset, offset + limit)
      const hasMore = offset + limit < cached.gifs.length
      return { gifs, hasMore }
    }

    // Filter all cached GIFs
    const matchingGifs = Array.from(this.allGifsCache.values())
      .filter((gif) => {
        const matchesQuery = gif.alt?.toLowerCase().includes(lowerQuery) ||
          gif.url.toLowerCase().includes(lowerQuery)
        const matchesPubkey = !filterByPubkey || gif.pubkey === filterByPubkey
        return matchesQuery && matchesPubkey
      })
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))

    // Cache the search results
    this.searchCache[cacheKey] = {
      gifs: matchingGifs,
      timestamp: Date.now()
    }

    const gifs = matchingGifs.slice(offset, offset + limit)
    const hasMore = offset + limit < matchingGifs.length

    return {
      gifs,
      hasMore
    }
  }

  async fetchMyGifs(pubkey: string, limit: number = 24, offset: number = 0): Promise<GifSearchResult> {
    await this.initialize()

    // Filter GIFs by pubkey and sort by created_at (most recent first)
    const myGifs = Array.from(this.allGifsCache.values())
      .filter((gif) => gif.pubkey === pubkey)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))

    const gifs = myGifs.slice(offset, offset + limit)
    const hasMore = offset + limit < myGifs.length

    return {
      gifs,
      hasMore
    }
  }

  async addUserGif(gifData: GifData): Promise<void> {
    if (gifData.eventId) {
      this.allGifsCache.set(gifData.eventId, gifData)
      await this.saveCacheToStorage()
      this.notifyCacheUpdate()
    }
  }

  async refreshCache(): Promise<void> {
    await this.backgroundFetchGifs()
  }

  getCacheSize(): number {
    return this.allGifsCache.size
  }

  async getCacheSizeFromDB(): Promise<number> {
    try {
      return await indexedDbService.getGifCount()
    } catch (error) {
      console.error('[GifService] Error getting cache size from DB:', error)
      return 0
    }
  }

  async clearCache(): Promise<void> {
    this.allGifsCache.clear()
    this.searchCache = {}
    await indexedDbService.clearGifCache()
    this.isInitialized = false
    this.initializationPromise = null
  }

  // Force fetch more GIFs manually
  async fetchMoreGifs(): Promise<number> {
    await this.initialize()
    const result = await this.fetchAndCacheGifs(2000)
    return result.newGifs
  }

  // Subscribe to cache updates
  onCacheUpdate(callback: () => void): () => void {
    this.updateCallbacks.add(callback)
    // Return unsubscribe function
    return () => {
      this.updateCallbacks.delete(callback)
    }
  }

  // Notify all subscribers of cache update
  private notifyCacheUpdate(): void {
    this.updateCallbacks.forEach(callback => {
      try {
        callback()
      } catch (error) {
        console.error('[GifService] Error in update callback:', error)
      }
    })
  }
}

const gifService = new GifService()
export default gifService
