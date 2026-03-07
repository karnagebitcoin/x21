import { BIG_RELAY_URLS } from '@/constants'
import { normalizeUrl } from '@/lib/url'
import { Event as NostrEvent, kinds, nip19 } from 'nostr-tools'

export const LIVE_STREAM_RELAYS = Array.from(
  new Set([
    ...BIG_RELAY_URLS,
    'wss://relay.snort.social/',
    'wss://relay.primal.net/',
    'wss://nostr.wine/'
  ])
)
  .map((relay) => normalizeUrl(relay))
  .filter((relay): relay is string => relay.length > 0)

export function getLiveStreamTagValue(event: NostrEvent, tagName: string): string | undefined {
  return event.tags.find((tag) => tag[0] === tagName)?.[1]
}

export function parseLiveStreamUnix(value?: string): number | null {
  if (!value) return null

  const normalized = value.trim()
  const parsed = Number(normalized)
  if (Number.isFinite(parsed)) {
    if (parsed > 1e10) return Math.floor(parsed / 1000)
    return Math.floor(parsed)
  }

  const dateMs = Date.parse(normalized)
  if (!Number.isNaN(dateMs)) return Math.floor(dateMs / 1000)

  return null
}

export function isActiveLiveStream(event: NostrEvent, now = Math.floor(Date.now() / 1000)) {
  if (event.kind !== kinds.LiveEvent) return false

  const status = getLiveStreamTagValue(event, 'status')?.trim().toLowerCase()
  if (status !== 'live') return false

  const starts = parseLiveStreamUnix(getLiveStreamTagValue(event, 'starts'))
  const ends = parseLiveStreamUnix(getLiveStreamTagValue(event, 'ends'))

  if (starts && starts > now + 10 * 60) return false
  if (ends && ends <= now) return false

  return true
}

export function getLiveStreamNaddr(event: NostrEvent) {
  if (event.kind !== kinds.LiveEvent) return undefined

  const identifier = getLiveStreamTagValue(event, 'd')
  if (!identifier) return undefined

  const relayHints = event.tags.find((tag) => tag[0] === 'relays')?.slice(1) ?? []
  const relays = relayHints.length > 0 ? relayHints : LIVE_STREAM_RELAYS.slice(0, 3)

  return nip19.naddrEncode({
    kind: kinds.LiveEvent,
    pubkey: event.pubkey,
    identifier,
    relays
  })
}

export function getLiveStreamTitle(event: NostrEvent, fallback = 'Untitled Live Stream') {
  return getLiveStreamTagValue(event, 'title') || fallback
}

export function getLiveStreamImage(event: NostrEvent) {
  return getLiveStreamTagValue(event, 'image')
}

export function getLiveStreamingUrl(event: NostrEvent) {
  return getLiveStreamTagValue(event, 'streaming')
}
