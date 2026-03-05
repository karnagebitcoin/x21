import client from '@/services/client.service'
import indexedDb from '@/services/indexed-db.service'
import { useEffect, useState } from 'react'

export type TLastActivityData = {
  pubkey: string
  lastPostTimestamp: number | null
  daysSinceLastPost: number | null
  isLoading: boolean
}

// Cache for last activity data - persists across component mounts
const lastActivityCache = new Map<string, { lastPostTimestamp: number | null; cachedAt: number }>()
const MEMORY_CACHE_DURATION = 5 * 60 * 1000 // 5 minutes
const PERSISTED_CACHE_DURATION = 12 * 60 * 60 * 1000 // 12 hours

export function useFetchLastActivity(pubkeys: string[], enabled: boolean = false) {
  const [activityMap, setActivityMap] = useState<Map<string, TLastActivityData>>(new Map())
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!enabled || pubkeys.length === 0) {
      return
    }

    const fetchLastActivity = async () => {
      setIsLoading(true)

      // Initialize all pubkeys as loading
      const newActivityMap = new Map<string, TLastActivityData>()
      pubkeys.forEach(pubkey => {
        newActivityMap.set(pubkey, {
          pubkey,
          lastPostTimestamp: null,
          daysSinceLastPost: null,
          isLoading: true
        })
      })
      setActivityMap(newActivityMap)

      // Check cache first
      const now = Date.now()
      const pubkeysToFetch: string[] = []
      const memoryMisses: string[] = []

      pubkeys.forEach(pubkey => {
        const cached = lastActivityCache.get(pubkey)
        if (cached && (now - cached.cachedAt) < MEMORY_CACHE_DURATION) {
          const daysSince = cached.lastPostTimestamp
            ? Math.floor((now - cached.lastPostTimestamp) / (1000 * 60 * 60 * 24))
            : null

          newActivityMap.set(pubkey, {
            pubkey,
            lastPostTimestamp: cached.lastPostTimestamp,
            daysSinceLastPost: daysSince,
            isLoading: false
          })
        } else {
          memoryMisses.push(pubkey)
        }
      })

      if (memoryMisses.length > 0) {
        try {
          const persistedCache = await indexedDb.getManyLastActivity(memoryMisses)
          memoryMisses.forEach(pubkey => {
            const cached = persistedCache.get(pubkey)
            if (cached && (now - cached.checkedAt) < PERSISTED_CACHE_DURATION) {
              const daysSince = cached.lastPostTimestamp
                ? Math.floor((now - cached.lastPostTimestamp) / (1000 * 60 * 60 * 24))
                : null

              newActivityMap.set(pubkey, {
                pubkey,
                lastPostTimestamp: cached.lastPostTimestamp,
                daysSinceLastPost: daysSince,
                isLoading: false
              })

              // Promote persisted cache to hot in-memory cache
              lastActivityCache.set(pubkey, {
                lastPostTimestamp: cached.lastPostTimestamp,
                cachedAt: cached.checkedAt
              })
            } else {
              pubkeysToFetch.push(pubkey)
            }
          })
        } catch (err) {
          console.error('[useFetchLastActivity] Failed to read IndexedDB cache:', err)
          pubkeysToFetch.push(...memoryMisses)
        }
      }

      // Update with cached data
      setActivityMap(new Map(newActivityMap))

      if (pubkeysToFetch.length === 0) {
        setIsLoading(false)
        return
      }

      const entriesToPersist: { pubkey: string; lastPostTimestamp: number | null; checkedAt: number }[] = []

      // Fetch individually to ensure each user gets checked properly
      // This prevents active users from crowding out inactive ones in results
      const BATCH_SIZE = 10
      for (let i = 0; i < pubkeysToFetch.length; i += BATCH_SIZE) {
        const batch = pubkeysToFetch.slice(i, i + BATCH_SIZE)

        try {
          // Fetch events for each author individually to avoid missing data
          // This is more reliable than batching with a limit
          const fetchPromises = batch.map(async (pubkey) => {
            try {
              const events = await client.fetchEvents([], {
                kinds: [1, 6],
                authors: [pubkey],
                limit: 1 // We only need the most recent event
              })
              return { pubkey, event: events[0] || null }
            } catch (error) {
              console.error(`Error fetching activity for ${pubkey}:`, error)
              return { pubkey, event: null }
            }
          })

          const results = await Promise.all(fetchPromises)

          // Update activity map with fetched data
          results.forEach(({ pubkey, event }) => {
            const lastPostTimestamp = event ? event.created_at * 1000 : null
            const daysSince = lastPostTimestamp
              ? Math.floor((now - lastPostTimestamp) / (1000 * 60 * 60 * 24))
              : null

            // Cache the result
            lastActivityCache.set(pubkey, {
              lastPostTimestamp,
              cachedAt: now
            })
            entriesToPersist.push({
              pubkey,
              lastPostTimestamp,
              checkedAt: now
            })

            newActivityMap.set(pubkey, {
              pubkey,
              lastPostTimestamp,
              daysSinceLastPost: daysSince,
              isLoading: false
            })
          })

          // Update state after each batch
          setActivityMap(new Map(newActivityMap))
        } catch (error) {
          console.error('Error fetching last activity for batch:', error)
          // Mark batch as failed
          batch.forEach(pubkey => {
            newActivityMap.set(pubkey, {
              pubkey,
              lastPostTimestamp: null,
              daysSinceLastPost: null,
              isLoading: false
            })
          })
          setActivityMap(new Map(newActivityMap))
        }
      }

      setIsLoading(false)

      // Persist successful fetches for faster future filter runs
      if (entriesToPersist.length > 0) {
        indexedDb.putManyLastActivity(entriesToPersist).catch((err) => {
          console.error('[useFetchLastActivity] Failed to write IndexedDB cache:', err)
        })
      }
    }

    fetchLastActivity()
  }, [pubkeys, enabled])

  return {
    activityMap,
    isLoading
  }
}

// Helper function to clear cache (useful for refresh)
export function clearLastActivityCache() {
  lastActivityCache.clear()
}
