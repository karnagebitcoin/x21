import { SimplePool } from 'nostr-tools'
import { AbstractRelay } from 'nostr-tools/abstract-relay'

const DEFAULT_CONNECTION_TIMEOUT = 5_000
const CLEANUP_THRESHOLD = 15
const CLEANUP_INTERVAL = 30_000
const IDLE_TIMEOUT = 10_000

export class SmartPool extends SimplePool {
  private relayIdleTracker = new Map<string, number>()

  constructor() {
    super({ enablePing: true })

    // Keep relay count bounded on long sessions.
    setInterval(() => this.cleanIdleRelays(), CLEANUP_INTERVAL)
  }

  ensureRelay(url: string): Promise<AbstractRelay> {
    if (!this.relayIdleTracker.has(url) && this.relayIdleTracker.size > CLEANUP_THRESHOLD) {
      this.cleanIdleRelays()
    }
    this.relayIdleTracker.set(url, Date.now())
    return super.ensureRelay(url, { connectionTimeout: DEFAULT_CONNECTION_TIMEOUT })
  }

  private cleanIdleRelays() {
    const idleRelays: string[] = []
    this.relays.forEach((relay, url) => {
      if (!relay.connected || relay.openSubs.size > 0) return

      const lastActivity = this.relayIdleTracker.get(url) ?? 0
      if (Date.now() - lastActivity < IDLE_TIMEOUT) return

      idleRelays.push(url)
      this.relayIdleTracker.delete(url)
    })

    if (idleRelays.length > 0) {
      this.close(idleRelays)
    }
  }
}
