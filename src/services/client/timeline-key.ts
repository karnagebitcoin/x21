import { sha256 } from '@noble/hashes/sha2'
import { Filter } from 'nostr-tools'

function toHexHash(input: string): string {
  const encoder = new TextEncoder()
  const data = encoder.encode(input)
  const hashBuffer = sha256(data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

function createStableFilter(filter: Filter): Record<string, unknown> {
  const stableFilter: Record<string, unknown> = {}
  Object.entries(filter)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([key, value]) => {
      if (Array.isArray(value)) {
        stableFilter[key] = [...value].sort()
      } else {
        stableFilter[key] = value
      }
    })
  return stableFilter
}

export function generateTimelineKey(urls: string[], filter: Filter): string {
  return toHexHash(
    JSON.stringify({
      urls: [...urls].sort(),
      filter: createStableFilter(filter)
    })
  )
}

export function generateMultipleTimelinesKey(
  subRequests: { urls: string[]; filter: Filter }[]
): string {
  const keys = subRequests.map(({ urls, filter }) => generateTimelineKey(urls, filter))
  return toHexHash(JSON.stringify(keys.sort()))
}
