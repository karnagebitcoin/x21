import { BIG_RELAY_URLS, ExtendedKind } from '@/constants'
import { getZapInfoFromEvent } from '@/lib/event-metadata'
import client from '@/services/client.service'
import dayjs from 'dayjs'
import { Event, Filter, kinds } from 'nostr-tools'

export type TListStats = {
  zapPrSet: Set<string>
  zaps: { pr: string; pubkey: string; amount: number; created_at: number; comment?: string }[]
  updatedAt?: number
}

class ListStatsService {
  static instance: ListStatsService
  private listStatsMap: Map<string, Partial<TListStats>> = new Map()
  private listStatsSubscribers = new Map<string, Set<() => void>>()

  constructor() {
    if (!ListStatsService.instance) {
      ListStatsService.instance = this
    }
    return ListStatsService.instance
  }

  /**
   * Get a unique key for a list based on author pubkey and d-tag
   */
  private getListKey(authorPubkey: string, dTag: string): string {
    return `${authorPubkey}:${dTag}`
  }

  async fetchListStats(authorPubkey: string, dTag: string, pubkey?: string | null) {
    const listKey = this.getListKey(authorPubkey, dTag)
    const oldStats = this.listStatsMap.get(listKey)
    let since: number | undefined
    if (oldStats?.updatedAt) {
      since = oldStats.updatedAt
    }

    const [authorProfile, authorRelayList] = await Promise.all([
      client.fetchProfile(authorPubkey),
      client.fetchRelayList(authorPubkey)
    ])

    const coordinate = `${ExtendedKind.STARTER_PACK}:${authorPubkey}:${dTag}`

    const filters: Filter[] = []

    // Fetch zaps for the list
    if (authorProfile?.lightningAddress) {
      filters.push({
        '#a': [coordinate],
        kinds: [kinds.Zap],
        limit: 500
      })

      if (pubkey) {
        filters.push({
          '#a': [coordinate],
          '#P': [pubkey],
          kinds: [kinds.Zap]
        })
      }
    }

    if (since) {
      filters.forEach((filter) => {
        filter.since = since
      })
    }

    if (filters.length === 0) {
      return this.listStatsMap.get(listKey) ?? {}
    }

    const events: Event[] = []
    const relays = authorRelayList.read.concat(BIG_RELAY_URLS).slice(0, 5)
    await client.fetchEvents(relays, filters, {
      onevent: (evt) => {
        this.updateListStatsByEvents(authorPubkey, dTag, [evt])
        events.push(evt)
      }
    })

    this.listStatsMap.set(listKey, {
      ...(this.listStatsMap.get(listKey) ?? {}),
      updatedAt: dayjs().unix()
    })

    return this.listStatsMap.get(listKey) ?? {}
  }

  subscribeListStats(authorPubkey: string, dTag: string, callback: () => void) {
    const listKey = this.getListKey(authorPubkey, dTag)
    let set = this.listStatsSubscribers.get(listKey)
    if (!set) {
      set = new Set()
      this.listStatsSubscribers.set(listKey, set)
    }
    set.add(callback)
    return () => {
      set?.delete(callback)
      if (set?.size === 0) this.listStatsSubscribers.delete(listKey)
    }
  }

  private notifyListStats(listKey: string) {
    const set = this.listStatsSubscribers.get(listKey)
    if (set) {
      set.forEach((cb) => cb())
    }
  }

  getListStats(authorPubkey: string, dTag: string): Partial<TListStats> | undefined {
    const listKey = this.getListKey(authorPubkey, dTag)
    return this.listStatsMap.get(listKey)
  }

  addZap(
    authorPubkey: string,
    dTag: string,
    zapperPubkey: string,
    pr: string,
    amount: number,
    comment?: string,
    created_at: number = dayjs().unix(),
    notify: boolean = true
  ) {
    const listKey = this.getListKey(authorPubkey, dTag)
    const old = this.listStatsMap.get(listKey) || {}
    const zapPrSet = old.zapPrSet || new Set()
    const zaps = old.zaps || []
    if (zapPrSet.has(pr)) return

    zapPrSet.add(pr)
    zaps.push({ pr, pubkey: zapperPubkey, amount, comment, created_at })
    this.listStatsMap.set(listKey, { ...old, zapPrSet, zaps })
    if (notify) {
      this.notifyListStats(listKey)
    }
    return listKey
  }

  updateListStatsByEvents(authorPubkey: string, dTag: string, events: Event[]) {
    const listKey = this.getListKey(authorPubkey, dTag)
    const updatedListKeySet = new Set<string>()

    events.forEach((evt) => {
      let updatedListKey: string | undefined
      if (evt.kind === kinds.Zap) {
        updatedListKey = this.addZapByEvent(authorPubkey, dTag, evt)
      }
      if (updatedListKey) {
        updatedListKeySet.add(updatedListKey)
      }
    })

    updatedListKeySet.forEach((key) => {
      this.notifyListStats(key)
    })
  }

  private addZapByEvent(authorPubkey: string, dTag: string, evt: Event) {
    const info = getZapInfoFromEvent(evt)
    if (!info) return
    const { senderPubkey, invoice, amount, comment } = info
    if (!senderPubkey) return

    return this.addZap(
      authorPubkey,
      dTag,
      senderPubkey,
      invoice,
      amount,
      comment,
      evt.created_at,
      false
    )
  }

  /**
   * Get total zap amount for a list
   */
  getTotalZapAmount(authorPubkey: string, dTag: string): number {
    const stats = this.getListStats(authorPubkey, dTag)
    if (!stats?.zaps) return 0
    return stats.zaps.reduce((acc, zap) => acc + zap.amount, 0)
  }

  /**
   * Check if a user has zapped a list
   */
  hasUserZapped(authorPubkey: string, dTag: string, userPubkey: string): boolean {
    const stats = this.getListStats(authorPubkey, dTag)
    if (!stats?.zaps) return false
    return stats.zaps.some((zap) => zap.pubkey === userPubkey)
  }
}

const instance = new ListStatsService()

export default instance
