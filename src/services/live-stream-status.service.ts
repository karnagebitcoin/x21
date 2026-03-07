import client from '@/services/client.service'
import { getLiveStreamNaddr, isActiveLiveStream, LIVE_STREAM_RELAYS } from '@/lib/live-stream'
import { Event as NostrEvent, kinds } from 'nostr-tools'

type TListener = () => void

class LiveStreamStatusService {
  static instance: LiveStreamStatusService

  private listeners = new Set<TListener>()
  private streamEventMap = new Map<string, NostrEvent>()
  private activeByPubkeyMap = new Map<string, NostrEvent>()
  private subscriptionCloser: { close: () => void } | null = null
  private pruneTimer: number | null = null
  private initialized = false

  public static getInstance() {
    if (!LiveStreamStatusService.instance) {
      LiveStreamStatusService.instance = new LiveStreamStatusService()
    }
    return LiveStreamStatusService.instance
  }

  subscribe = (listener: TListener) => {
    this.listeners.add(listener)
    this.ensureInitialized()
    return () => {
      this.listeners.delete(listener)
    }
  }

  getLiveEvent(pubkey?: string) {
    if (!pubkey) return undefined
    return this.activeByPubkeyMap.get(pubkey)
  }

  getSnapshot(pubkey?: string) {
    const event = this.getLiveEvent(pubkey)
    const naddr = event ? getLiveStreamNaddr(event) : undefined

    return {
      event,
      naddr,
      isLive: !!event && !!naddr
    }
  }

  private ensureInitialized() {
    if (this.initialized) return
    this.initialized = true

    this.hydrate(client.getCachedLiveStreamEvents(Number.MAX_SAFE_INTEGER))

    client.prefetchLiveStreamEvents({ relays: LIVE_STREAM_RELAYS }).then((events) => {
      this.hydrate(events)
    })

    this.subscriptionCloser = client.subscribe(
      LIVE_STREAM_RELAYS,
      { kinds: [kinds.LiveEvent], limit: 200 },
      {
        onevent: (event: NostrEvent) => {
          client.cacheLiveStreamEvents([event])
          this.upsertEvent(event)
        }
      }
    )

    this.pruneTimer = window.setInterval(() => {
      this.rebuildActiveStreams()
    }, 30_000)
  }

  private hydrate(events: NostrEvent[]) {
    let changed = false

    events.forEach((event) => {
      changed = this.upsertEvent(event, false) || changed
    })

    if (changed) {
      this.rebuildActiveStreams()
    }
  }

  private upsertEvent(event: NostrEvent, shouldNotify = true) {
    if (event.kind !== kinds.LiveEvent) return false

    const dTag = event.tags.find((tag) => tag[0] === 'd')?.[1]
    const key = dTag ? `${event.pubkey}:${dTag}` : event.id
    const existing = this.streamEventMap.get(key)
    if (existing && existing.created_at >= event.created_at) {
      return false
    }

    this.streamEventMap.set(key, event)
    if (shouldNotify) {
      this.rebuildActiveStreams()
    }
    return true
  }

  private rebuildActiveStreams() {
    const nextActiveByPubkey = new Map<string, NostrEvent>()

    for (const event of this.streamEventMap.values()) {
      if (!isActiveLiveStream(event)) continue
      const existing = nextActiveByPubkey.get(event.pubkey)
      if (!existing || event.created_at > existing.created_at) {
        nextActiveByPubkey.set(event.pubkey, event)
      }
    }

    const changed =
      nextActiveByPubkey.size !== this.activeByPubkeyMap.size ||
      Array.from(nextActiveByPubkey.entries()).some(([pubkey, event]) => {
        return this.activeByPubkeyMap.get(pubkey)?.id !== event.id
      })

    if (!changed) return

    this.activeByPubkeyMap = nextActiveByPubkey
    this.emit()
  }

  private emit() {
    this.listeners.forEach((listener) => listener())
  }
}

const instance = LiveStreamStatusService.getInstance()

export default instance
