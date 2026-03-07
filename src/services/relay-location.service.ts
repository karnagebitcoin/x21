type TRelayLocation = {
  url: string
  hostname: string
  lat: number
  lng: number
  city?: string
  region?: string
  country?: string
  countryCode?: string
  timezone?: string
  isp?: string
  org?: string
  query?: string
  updatedAt?: number
}

class RelayLocationService {
  static instance: RelayLocationService

  private cache = new Map<string, TRelayLocation>()

  static getInstance() {
    if (!RelayLocationService.instance) {
      RelayLocationService.instance = new RelayLocationService()
    }
    return RelayLocationService.instance
  }

  async fetchRelayLocations(urls: string[]) {
    const uniqueUrls = Array.from(new Set(urls.filter(Boolean)))
    const missingUrls = uniqueUrls.filter((url) => !this.cache.has(url))

    if (missingUrls.length > 0) {
      const res = await fetch('/v1/relay/locations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ urls: missingUrls })
      })

      if (!res.ok) {
        throw new Error('Failed to fetch relay locations')
      }

      const data = (await res.json()) as { locations?: TRelayLocation[] }
      data.locations?.forEach((location) => {
        this.cache.set(location.url, location)
      })
    }

    return uniqueUrls
      .map((url) => this.cache.get(url))
      .filter((location): location is TRelayLocation => Boolean(location))
  }
}

const instance = RelayLocationService.getInstance()
export type { TRelayLocation }
export default instance
