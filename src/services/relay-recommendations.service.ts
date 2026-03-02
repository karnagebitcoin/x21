import client from '@/services/client.service'
import relayHealthService, { TRelayHealthResult } from '@/services/relay-health.service'
import indexedDb from '@/services/indexed-db.service'

export type TRelayRecommendation = {
  url: string
  followerCount: number
  followers: string[] // pubkeys of followers who use this relay
  health?: TRelayHealthResult
}

class RelayRecommendationsService {
  private static instance: RelayRecommendationsService
  private cache: Map<string, TRelayRecommendation[]> = new Map()
  private fetchPromise: Map<string, Promise<TRelayRecommendation[]>> = new Map()

  public static getInstance(): RelayRecommendationsService {
    if (!RelayRecommendationsService.instance) {
      RelayRecommendationsService.instance = new RelayRecommendationsService()
    }
    return RelayRecommendationsService.instance
  }

  /**
   * Get relay recommendations based on where your follows publish (their write relays)
   * Returns relays sorted by how many of your follows use them
   */
  async getRecommendations(pubkey: string): Promise<TRelayRecommendation[]> {
    // Return cached data if available
    const cached = this.cache.get(pubkey)
    if (cached) {
      return cached
    }

    // Dedupe concurrent requests
    const existingPromise = this.fetchPromise.get(pubkey)
    if (existingPromise) {
      return existingPromise
    }

    const promise = this._fetchRecommendations(pubkey)
    this.fetchPromise.set(pubkey, promise)

    try {
      const result = await promise
      this.cache.set(pubkey, result)
      return result
    } finally {
      this.fetchPromise.delete(pubkey)
    }
  }

  /**
   * Get recommendations with health checks for the top N relays
   */
  async getRecommendationsWithHealth(
    pubkey: string,
    topN: number = 15
  ): Promise<TRelayRecommendation[]> {
    const recommendations = await this.getRecommendations(pubkey)

    // Health check the top N relays
    const topRelays = recommendations.slice(0, topN)
    const healthResults = await relayHealthService.checkRelaysHealth(
      topRelays.map((r) => r.url)
    )

    // Attach health results
    return recommendations.map((rec) => ({
      ...rec,
      health: healthResults.get(rec.url)
    }))
  }

  /**
   * Clear cached recommendations for a user
   */
  clearCache(pubkey?: string) {
    if (pubkey) {
      this.cache.delete(pubkey)
    } else {
      this.cache.clear()
    }
  }

  private async _fetchRecommendations(pubkey: string): Promise<TRelayRecommendation[]> {
    // Get list of people the user follows
    const followings = await client.fetchFollowings(pubkey)

    if (followings.length === 0) {
      return []
    }

    // Fetch relay lists for all followings
    const relayLists = await client.fetchRelayLists(followings)

    // Aggregate write relays and count followers per relay
    const relayMap = new Map<string, Set<string>>()

    relayLists.forEach((relayList, index) => {
      const followerPubkey = followings[index]

      // Get write relays (both 'write' and 'both' scopes)
      relayList.write.forEach((url) => {
        if (!relayMap.has(url)) {
          relayMap.set(url, new Set())
        }
        relayMap.get(url)!.add(followerPubkey)
      })
    })

    // Convert to array and sort by follower count
    const recommendations: TRelayRecommendation[] = Array.from(relayMap.entries())
      .map(([url, followers]) => ({
        url,
        followerCount: followers.size,
        followers: Array.from(followers)
      }))
      .sort((a, b) => b.followerCount - a.followerCount)

    return recommendations
  }
}

const instance = RelayRecommendationsService.getInstance()
export default instance
