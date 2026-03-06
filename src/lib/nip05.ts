import { LRUCache } from 'lru-cache'
import { isValidPubkey } from './pubkey'

type TVerifyNip05Result = {
  isVerified: boolean
  nip05Name: string
  nip05Domain: string
}

const verifyNip05ResultCache = new LRUCache<string, TVerifyNip05Result>({
  max: 1000,
  ttl: 5 * 60 * 1000,
  fetchMethod: (key) => {
    const { nip05, pubkey } = JSON.parse(key)
    return _verifyNip05(nip05, pubkey)
  }
})

async function _verifyNip05(nip05: string, pubkey: string): Promise<TVerifyNip05Result> {
  const [rawNip05Name, rawNip05Domain] = nip05?.split('@') || [undefined, undefined]
  const nip05Name = rawNip05Name?.trim().toLowerCase()
  const nip05Domain = rawNip05Domain?.trim().toLowerCase()
  const result = { isVerified: false, nip05Name, nip05Domain }
  if (!nip05Name || !nip05Domain || !pubkey) return result

  try {
    const res = await fetch(getWellKnownNip05Url(nip05Domain, nip05Name))
    const json = await res.json()
    if (String(json.names?.[nip05Name] || '').toLowerCase() === String(pubkey).toLowerCase()) {
      return { ...result, isVerified: true }
    }
  } catch {
    // ignore
  }
  return result
}

export async function verifyNip05(nip05: string, pubkey: string): Promise<TVerifyNip05Result> {
  const result = await verifyNip05ResultCache.fetch(JSON.stringify({ nip05, pubkey }))
  if (result) {
    return result
  }
  const [rawNip05Name, rawNip05Domain] = nip05?.split('@') || [undefined, undefined]
  const nip05Name = rawNip05Name?.trim().toLowerCase()
  const nip05Domain = rawNip05Domain?.trim().toLowerCase()
  return { isVerified: false, nip05Name, nip05Domain }
}

export function getWellKnownNip05Url(domain: string, name?: string): string {
  const url = new URL('/.well-known/nostr.json', `https://${domain}`)
  if (name) {
    url.searchParams.set('name', name)
  }
  return url.toString()
}

export async function fetchPubkeysFromDomain(domain: string): Promise<string[]> {
  try {
    const res = await fetch(getWellKnownNip05Url(domain))
    const json = await res.json()
    const pubkeySet = new Set<string>()
    return Object.values(json.names || {}).filter((pubkey) => {
      if (typeof pubkey !== 'string' || !isValidPubkey(pubkey)) {
        return false
      }
      if (pubkeySet.has(pubkey)) {
        return false
      }
      pubkeySet.add(pubkey)
      return true
    }) as string[]
  } catch (error) {
    console.error('Error fetching pubkeys from domain:', error)
    return []
  }
}
