import { BIG_RELAY_URLS } from '@/constants'
import { getReplaceableCoordinateFromEvent, isReplaceableEvent } from '@/lib/event'
import { getZapInfoFromEvent } from '@/lib/event-metadata'
import { getEmojiInfosFromEmojiTags, tagNameEquals } from '@/lib/tag'
import client from '@/services/client.service'
import { TEmoji } from '@/types'
import dayjs from 'dayjs'
import { Event, Filter, kinds } from 'nostr-tools'

export type TNoteStats = {
  likeIdSet: Set<string>
  likes: { id: string; pubkey: string; created_at: number; emoji: TEmoji | string }[]
  repostPubkeySet: Set<string>
  reposts: { id: string; pubkey: string; created_at: number }[]
  zapPrSet: Set<string>
  zaps: { pr: string; pubkey: string; amount: number; created_at: number; comment?: string }[]
  updatedAt?: number
}

type TTrackedNote = {
  eventId: string
  replaceableCoordinate?: string
  touchedAt: number
}

type TInteractionMeta =
  | { type: 'reaction'; targetEventId: string; pubkey: string }
  | { type: 'repost'; targetEventId: string; pubkey: string }
  | { type: 'zap'; targetEventId: string; pr: string }

const NOTE_STATS_FRESH_SECONDS = 15
const NOTE_STATS_BATCH_DEBOUNCE_MS = 40
const NOTE_STATS_TRACK_TTL_SECONDS = 10 * 60
const NOTE_STATS_BATCH_MAX_NOTES = 60
const NOTE_STATS_LIVE_RELAYS_LIMIT = 10
const NOTE_STATS_FETCH_RELAYS_LIMIT = 8

class NoteStatsService {
  static instance: NoteStatsService
  private noteStatsMap: Map<string, Partial<TNoteStats>> = new Map()
  private noteStatsSubscribers = new Map<string, Set<() => void>>()
  private pendingFetchMap = new Map<string, { event: Event; pubkey?: string | null }>()
  private inflightFetchMap = new Map<string, Promise<Partial<TNoteStats>>>()
  private pendingResolvers = new Map<
    string,
    {
      resolve: (stats: Partial<TNoteStats>) => void
      reject: (error: unknown) => void
    }
  >()
  private fetchTimer: ReturnType<typeof setTimeout> | null = null
  private trackedNotes = new Map<string, TTrackedNote>()
  private interactionMetaById = new Map<string, TInteractionMeta>()
  private liveCloser: (() => void) | null = null
  private liveRefreshTimer: ReturnType<typeof setTimeout> | null = null

  constructor() {
    if (!NoteStatsService.instance) {
      NoteStatsService.instance = this
    }
    return NoteStatsService.instance
  }

  async fetchNoteStats(event: Event, pubkey?: string | null) {
    const existing = this.noteStatsMap.get(event.id)
    const now = dayjs().unix()
    if (existing?.updatedAt && now - existing.updatedAt <= NOTE_STATS_FRESH_SECONDS) {
      this.trackNote(event)
      return existing
    }

    const inflight = this.inflightFetchMap.get(event.id)
    if (inflight) return inflight

    this.trackNote(event)

    const promise = new Promise<Partial<TNoteStats>>((resolve, reject) => {
      this.pendingFetchMap.set(event.id, { event, pubkey })
      this.pendingResolvers.set(event.id, { resolve, reject })
      this.scheduleBatchFetch()
    }).finally(() => {
      this.inflightFetchMap.delete(event.id)
    })

    this.inflightFetchMap.set(event.id, promise)
    return promise
  }

  prefetchNoteStats(events: Event[], pubkey?: string | null, max = NOTE_STATS_BATCH_MAX_NOTES) {
    const uniqueEvents = new Map<string, Event>()
    for (const event of events) {
      if (!event?.id || uniqueEvents.has(event.id)) continue
      uniqueEvents.set(event.id, event)
      if (uniqueEvents.size >= max) break
    }

    uniqueEvents.forEach((event) => {
      void this.fetchNoteStats(event, pubkey).catch(() => {})
    })
  }

  subscribeNoteStats(noteId: string, callback: () => void) {
    let set = this.noteStatsSubscribers.get(noteId)
    if (!set) {
      set = new Set()
      this.noteStatsSubscribers.set(noteId, set)
    }
    set.add(callback)
    return () => {
      set?.delete(callback)
      if (set?.size === 0) this.noteStatsSubscribers.delete(noteId)
    }
  }

  private notifyNoteStats(noteId: string) {
    const set = this.noteStatsSubscribers.get(noteId)
    if (set) {
      set.forEach((cb) => cb())
    }
  }

  getNoteStats(id: string): Partial<TNoteStats> | undefined {
    return this.noteStatsMap.get(id)
  }

  addZap(
    pubkey: string,
    eventId: string,
    pr: string,
    amount: number,
    comment?: string,
    created_at: number = dayjs().unix(),
    notify: boolean = true
  ) {
    const old = this.noteStatsMap.get(eventId) || {}
    const zapPrSet = old.zapPrSet || new Set()
    const zaps = old.zaps || []
    if (zapPrSet.has(pr)) return

    zapPrSet.add(pr)
    zaps.push({ pr, pubkey, amount, comment, created_at })
    this.noteStatsMap.set(eventId, { ...old, zapPrSet, zaps })
    if (notify) {
      this.notifyNoteStats(eventId)
    }
    return eventId
  }

  updateNoteStatsByEvents(events: Event[]) {
    const updatedEventIdSet = new Set<string>()
    events.forEach((evt) => {
      let updatedEventId: string | undefined
      if (evt.kind === kinds.Reaction) {
        updatedEventId = this.addLikeByEvent(evt)
      } else if (evt.kind === kinds.Repost) {
        updatedEventId = this.addRepostByEvent(evt)
      } else if (evt.kind === kinds.Zap) {
        updatedEventId = this.addZapByEvent(evt)
      } else if (evt.kind === kinds.EventDeletion) {
        this.removeInteractionsByDeletionEvent(evt).forEach((id) => updatedEventIdSet.add(id))
      }
      if (updatedEventId) {
        updatedEventIdSet.add(updatedEventId)
      }
    })
    updatedEventIdSet.forEach((eventId) => {
      this.notifyNoteStats(eventId)
    })
  }

  private addLikeByEvent(evt: Event) {
    const targetEventId = evt.tags.findLast(tagNameEquals('e'))?.[1]
    if (!targetEventId) return

    const old = this.noteStatsMap.get(targetEventId) || {}
    const likeIdSet = old.likeIdSet || new Set()
    const likes = old.likes || []
    if (likeIdSet.has(evt.id)) return

    let emoji: TEmoji | string = evt.content.trim()
    if (!emoji) return

    if (emoji.startsWith(':') && emoji.endsWith(':')) {
      const emojiInfos = getEmojiInfosFromEmojiTags(evt.tags)
      const shortcode = emoji.split(':')[1]
      const emojiInfo = emojiInfos.find((info) => info.shortcode === shortcode)
      if (emojiInfo) {
        emoji = emojiInfo
      } else {
        emoji = '+'
      }
    }

    likeIdSet.add(evt.id)
    likes.push({ id: evt.id, pubkey: evt.pubkey, created_at: evt.created_at, emoji })
    this.noteStatsMap.set(targetEventId, { ...old, likeIdSet, likes })
    this.interactionMetaById.set(evt.id, {
      type: 'reaction',
      targetEventId,
      pubkey: evt.pubkey
    })
    return targetEventId
  }

  private addRepostByEvent(evt: Event) {
    const eventId = evt.tags.find(tagNameEquals('e'))?.[1]
    if (!eventId) return

    const old = this.noteStatsMap.get(eventId) || {}
    const repostPubkeySet = old.repostPubkeySet || new Set()
    const reposts = old.reposts || []
    if (repostPubkeySet.has(evt.pubkey)) return

    repostPubkeySet.add(evt.pubkey)
    reposts.push({ id: evt.id, pubkey: evt.pubkey, created_at: evt.created_at })
    this.noteStatsMap.set(eventId, { ...old, repostPubkeySet, reposts })
    this.interactionMetaById.set(evt.id, { type: 'repost', targetEventId: eventId, pubkey: evt.pubkey })
    return eventId
  }

  private addZapByEvent(evt: Event) {
    const info = getZapInfoFromEvent(evt)
    if (!info) return
    const { originalEventId, senderPubkey, invoice, amount, comment } = info
    if (!originalEventId || !senderPubkey) return

    const targetEventId = this.addZap(
      senderPubkey,
      originalEventId,
      invoice,
      amount,
      comment,
      evt.created_at,
      false
    )
    if (targetEventId) {
      this.interactionMetaById.set(evt.id, { type: 'zap', targetEventId, pr: invoice })
    }
    return targetEventId
  }

  private scheduleBatchFetch() {
    if (this.fetchTimer) return
    this.fetchTimer = setTimeout(() => {
      this.fetchTimer = null
      void this.flushBatchFetches()
    }, NOTE_STATS_BATCH_DEBOUNCE_MS)
  }

  private async flushBatchFetches() {
    if (!this.pendingFetchMap.size) return

    const requests = Array.from(this.pendingFetchMap.values()).slice(0, NOTE_STATS_BATCH_MAX_NOTES)
    this.pendingFetchMap.clear()

    const requestById = new Map<string, { event: Event; pubkey?: string | null }>()
    requests.forEach((request) => {
      requestById.set(request.event.id, request)
    })
    const now = dayjs().unix()
    const ids = Array.from(requestById.keys())

    try {
      const idSinceMap = new Map<string, number>()
      const authors = new Set<string>()
      const eventIds = new Set<string>()
      const replaceableCoordinates = new Set<string>()

      requestById.forEach(({ event }, noteId) => {
        const oldStats = this.noteStatsMap.get(noteId)
        if (oldStats?.updatedAt) {
          idSinceMap.set(noteId, oldStats.updatedAt)
        }

        authors.add(event.pubkey)
        eventIds.add(event.id)

        if (isReplaceableEvent(event.kind)) {
          replaceableCoordinates.add(getReplaceableCoordinateFromEvent(event))
        }
      })

      const relayLists = await client.fetchRelayLists(Array.from(authors))
      const relayUrls = this.pickRelayUrls(relayLists)
      const filters = this.buildBatchFilters(eventIds, replaceableCoordinates, idSinceMap)

      if (filters.length && relayUrls.length) {
        await client.fetchEvents(relayUrls, filters, {
          onevent: (evt) => {
            this.updateNoteStatsByEvents([evt])
          }
        })
      }

      ids.forEach((id) => {
        this.noteStatsMap.set(id, {
          ...(this.noteStatsMap.get(id) ?? {}),
          updatedAt: now
        })
        this.pendingResolvers.get(id)?.resolve(this.noteStatsMap.get(id) ?? {})
        this.pendingResolvers.delete(id)
      })
    } catch (error) {
      ids.forEach((id) => {
        this.pendingResolvers.get(id)?.reject(error)
        this.pendingResolvers.delete(id)
      })
    }

    if (this.pendingFetchMap.size) {
      this.scheduleBatchFetch()
    }
  }

  private buildBatchFilters(
    eventIds: Set<string>,
    replaceableCoordinates: Set<string>,
    idSinceMap: Map<string, number>
  ) {
    const ids = Array.from(eventIds)
    const coordinates = Array.from(replaceableCoordinates)
    const since = idSinceMap.size ? Math.min(...idSinceMap.values()) : undefined

    const reactionLimit = Math.min(3000, Math.max(600, ids.length * 80))
    const repostLimit = Math.min(1200, Math.max(200, ids.length * 20))
    const zapLimit = Math.min(3000, Math.max(600, ids.length * 60))

    const filters: Filter[] = []

    if (ids.length) {
      filters.push(
        { '#e': ids, kinds: [kinds.Reaction], limit: reactionLimit },
        { '#e': ids, kinds: [kinds.Repost], limit: repostLimit },
        { '#e': ids, kinds: [kinds.Zap], limit: zapLimit },
        { '#e': ids, kinds: [kinds.EventDeletion], limit: reactionLimit }
      )
    }

    if (coordinates.length) {
      filters.push(
        { '#a': coordinates, kinds: [kinds.Reaction], limit: reactionLimit },
        { '#a': coordinates, kinds: [kinds.Repost], limit: repostLimit },
        { '#a': coordinates, kinds: [kinds.Zap], limit: zapLimit }
      )
    }

    if (since) {
      filters.forEach((filter) => {
        filter.since = since
      })
    }

    return filters
  }

  private pickRelayUrls(relayLists: { read: string[] }[]) {
    const relayScoreMap = new Map<string, number>()

    BIG_RELAY_URLS.forEach((relayUrl, index) => {
      relayScoreMap.set(relayUrl, 100 - index)
    })

    relayLists.forEach((relayList) => {
      relayList.read.slice(0, 4).forEach((relayUrl, index) => {
        relayScoreMap.set(relayUrl, (relayScoreMap.get(relayUrl) ?? 0) + (10 - index))
      })
    })

    return Array.from(relayScoreMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([relayUrl]) => relayUrl)
      .slice(0, NOTE_STATS_FETCH_RELAYS_LIMIT)
  }

  private trackNote(event: Event) {
    const touchedAt = dayjs().unix()
    this.trackedNotes.set(event.id, {
      eventId: event.id,
      replaceableCoordinate: isReplaceableEvent(event.kind)
        ? getReplaceableCoordinateFromEvent(event)
        : undefined,
      touchedAt
    })

    this.scheduleLiveRefresh()
  }

  private scheduleLiveRefresh() {
    if (this.liveRefreshTimer) return
    this.liveRefreshTimer = setTimeout(() => {
      this.liveRefreshTimer = null
      this.refreshLiveSubscription()
    }, 300)
  }

  private refreshLiveSubscription() {
    const now = dayjs().unix()
    const minTouchedAt = now - NOTE_STATS_TRACK_TTL_SECONDS
    const tracked = Array.from(this.trackedNotes.values()).filter((item) => item.touchedAt >= minTouchedAt)

    this.trackedNotes = new Map(tracked.map((item) => [item.eventId, item]))

    this.liveCloser?.()
    this.liveCloser = null

    if (!tracked.length) return

    const ids = tracked.map((item) => item.eventId)
    const coordinates = tracked
      .map((item) => item.replaceableCoordinate)
      .filter((item): item is string => !!item)
    const relayUrls = this.getLiveRelayUrls(ids)
    if (!relayUrls.length) return

    const filters: Filter[] = [
      {
        '#e': ids,
        kinds: [kinds.Reaction, kinds.Repost, kinds.Zap, kinds.EventDeletion],
        since: now
      }
    ]

    if (coordinates.length) {
      filters.push({
        '#a': coordinates,
        kinds: [kinds.Reaction, kinds.Repost, kinds.Zap],
        since: now
      })
    }

    const sub = client.subscribe(relayUrls, filters, {
      onevent: (evt) => {
        this.updateNoteStatsByEvents([evt])
      }
    })

    this.liveCloser = () => sub.close()
  }

  private getLiveRelayUrls(eventIds: string[]) {
    const relaySet = new Set<string>()
    BIG_RELAY_URLS.forEach((relayUrl) => relaySet.add(relayUrl))

    eventIds.forEach((eventId) => {
      client.getSeenEventRelayUrls(eventId).forEach((relayUrl) => relaySet.add(relayUrl))
    })

    return Array.from(relaySet).slice(0, NOTE_STATS_LIVE_RELAYS_LIMIT)
  }

  private removeInteractionsByDeletionEvent(evt: Event): Set<string> {
    const updatedEventIds = new Set<string>()
    const deletedIds = evt.tags.filter(tagNameEquals('e')).map(([, id]) => id)

    deletedIds.forEach((deletedId) => {
      const interactionMeta = this.interactionMetaById.get(deletedId)
      if (!interactionMeta) return

      const old = this.noteStatsMap.get(interactionMeta.targetEventId)
      if (!old) return

      if (interactionMeta.type === 'reaction') {
        const likeIdSet = old.likeIdSet ? new Set(old.likeIdSet) : new Set<string>()
        const likes = old.likes ? [...old.likes] : []
        if (!likeIdSet.has(deletedId)) return

        likeIdSet.delete(deletedId)
        const nextLikes = likes.filter((like) => like.id !== deletedId)
        this.noteStatsMap.set(interactionMeta.targetEventId, { ...old, likeIdSet, likes: nextLikes })
      } else if (interactionMeta.type === 'repost') {
        const repostPubkeySet = old.repostPubkeySet ? new Set(old.repostPubkeySet) : new Set<string>()
        const reposts = old.reposts ? [...old.reposts] : []

        repostPubkeySet.delete(interactionMeta.pubkey)
        const nextReposts = reposts.filter((repost) => repost.id !== deletedId)
        this.noteStatsMap.set(interactionMeta.targetEventId, {
          ...old,
          repostPubkeySet,
          reposts: nextReposts
        })
      } else if (interactionMeta.type === 'zap') {
        const zapPrSet = old.zapPrSet ? new Set(old.zapPrSet) : new Set<string>()
        const zaps = old.zaps ? [...old.zaps] : []

        zapPrSet.delete(interactionMeta.pr)
        const nextZaps = zaps.filter((zap) => zap.pr !== interactionMeta.pr)
        this.noteStatsMap.set(interactionMeta.targetEventId, { ...old, zapPrSet, zaps: nextZaps })
      }

      this.interactionMetaById.delete(deletedId)
      updatedEventIds.add(interactionMeta.targetEventId)
    })

    return updatedEventIds
  }
}

const instance = new NoteStatsService()

export default instance
