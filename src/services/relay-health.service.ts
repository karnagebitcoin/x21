export type TRelayHealthStatus = 'checking' | 'great' | 'good' | 'average' | 'poor' | 'unreachable'

export type TRelayHealthResult = {
  url: string
  status: TRelayHealthStatus
  latency?: number // in milliseconds
}

const LATENCY_THRESHOLDS = {
  great: 100,
  good: 300,
  average: 600
  // poor: > 600ms
}

const CONNECTION_TIMEOUT = 10000 // 10 seconds

class RelayHealthService {
  private static instance: RelayHealthService
  private healthCache = new Map<string, TRelayHealthResult>()

  public static getInstance(): RelayHealthService {
    if (!RelayHealthService.instance) {
      RelayHealthService.instance = new RelayHealthService()
    }
    return RelayHealthService.instance
  }

  /**
   * Check the health of a single relay by measuring WebSocket connection latency
   */
  async checkRelayHealth(url: string): Promise<TRelayHealthResult> {
    const startTime = performance.now()

    return new Promise((resolve) => {
      let ws: WebSocket | null = null
      let resolved = false

      const cleanup = () => {
        if (ws) {
          ws.onopen = null
          ws.onerror = null
          ws.onclose = null
          try {
            ws.close()
          } catch {
            // Ignore close errors
          }
          ws = null
        }
      }

      const resolveWith = (result: TRelayHealthResult) => {
        if (resolved) return
        resolved = true
        cleanup()
        this.healthCache.set(url, result)
        resolve(result)
      }

      // Set timeout for connection
      const timeout = setTimeout(() => {
        resolveWith({ url, status: 'unreachable' })
      }, CONNECTION_TIMEOUT)

      try {
        ws = new WebSocket(url)

        ws.onopen = () => {
          clearTimeout(timeout)
          const latency = Math.round(performance.now() - startTime)
          const status = this.getStatusFromLatency(latency)
          resolveWith({ url, status, latency })
        }

        ws.onerror = () => {
          clearTimeout(timeout)
          resolveWith({ url, status: 'unreachable' })
        }

        ws.onclose = () => {
          clearTimeout(timeout)
          if (!resolved) {
            resolveWith({ url, status: 'unreachable' })
          }
        }
      } catch {
        clearTimeout(timeout)
        resolveWith({ url, status: 'unreachable' })
      }
    })
  }

  /**
   * Check health of multiple relays in parallel
   */
  async checkRelaysHealth(urls: string[]): Promise<Map<string, TRelayHealthResult>> {
    const results = await Promise.all(urls.map((url) => this.checkRelayHealth(url)))
    const resultMap = new Map<string, TRelayHealthResult>()
    results.forEach((result) => {
      resultMap.set(result.url, result)
    })
    return resultMap
  }

  /**
   * Get cached health result for a relay
   */
  getCachedHealth(url: string): TRelayHealthResult | undefined {
    return this.healthCache.get(url)
  }

  /**
   * Clear cached health results
   */
  clearCache(): void {
    this.healthCache.clear()
  }

  private getStatusFromLatency(latency: number): TRelayHealthStatus {
    if (latency < LATENCY_THRESHOLDS.great) return 'great'
    if (latency < LATENCY_THRESHOLDS.good) return 'good'
    if (latency < LATENCY_THRESHOLDS.average) return 'average'
    return 'poor'
  }
}

const instance = RelayHealthService.getInstance()
export default instance
