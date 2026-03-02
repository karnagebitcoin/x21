import { getReplaceableCoordinate } from '@/lib/event'
import indexedDb from '@/services/indexed-db.service'
import DataLoader from 'dataloader'
import { Event, kinds } from 'nostr-tools'

type TReplaceableLoader = DataLoader<
  { pubkey: string; kind: number },
  Event | null,
  string
>

type TPrefetchOptions = {
  events: Event[]
  replaceableEventCacheMap: Map<string, Event>
  replaceableEventFromBigRelaysDataloader: TReplaceableLoader
}

function extractUniquePubkeys(events: Event[]): string[] {
  const uniquePubkeys = new Set<string>()

  events.forEach((evt) => {
    uniquePubkeys.add(evt.pubkey)
    // Prefetch mentioned users from p-tags to reduce avatar/name pop-in.
    evt.tags.forEach(([tagName, tagValue]) => {
      if (tagName === 'p' && tagValue && /^[0-9a-f]{64}$/.test(tagValue)) {
        uniquePubkeys.add(tagValue)
      }
    })
  })

  return Array.from(uniquePubkeys)
}

export async function prefetchProfilesForEvents({
  events,
  replaceableEventCacheMap,
  replaceableEventFromBigRelaysDataloader
}: TPrefetchOptions): Promise<void> {
  if (events.length === 0) return

  const uniquePubkeys = extractUniquePubkeys(events)
  const pubkeysToFetch = uniquePubkeys.filter((pubkey) => {
    const coordinate = getReplaceableCoordinate(kinds.Metadata, pubkey)
    return !replaceableEventCacheMap.has(coordinate)
  })

  if (pubkeysToFetch.length === 0) return

  const cachedEvents = await indexedDb.getManyReplaceableEvents(pubkeysToFetch, kinds.Metadata)
  const stillNeedFetch: string[] = []

  pubkeysToFetch.forEach((pubkey, i) => {
    const cachedEvent = cachedEvents[i]
    if (cachedEvent) {
      const coordinate = getReplaceableCoordinate(kinds.Metadata, pubkey)
      replaceableEventCacheMap.set(coordinate, cachedEvent)
      replaceableEventFromBigRelaysDataloader.prime(
        { pubkey, kind: kinds.Metadata },
        Promise.resolve(cachedEvent)
      )
    } else if (cachedEvent === undefined) {
      // `undefined` means "not cached", `null` means known miss.
      stillNeedFetch.push(pubkey)
    }
  })

  stillNeedFetch.forEach((pubkey) => {
    replaceableEventFromBigRelaysDataloader.load({ pubkey, kind: kinds.Metadata })
  })
}
