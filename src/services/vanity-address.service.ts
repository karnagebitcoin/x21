import { JUMBLE_API_BASE_URL } from '@/constants'
import client from '@/services/client.service'

type TVanityAccount = {
  domain: string
  claimable: boolean
  ownerCanClaimFree?: boolean
  eligibility?: {
    eligible: boolean
    source?: string | null
    markedAt?: number | null
  }
  assignment?: {
    name: string
    expiresAt: number | null
    createdAt?: number | null
    updatedAt?: number | null
  } | null
  pricing?: {
    minSats: number
    maxSats: number
    termDays: number
    currentSats?: number | null
  }
}

type TVanityClaimCreate = {
  claimId: string
  transactionId: string
  state: 'pending' | 'settled' | 'failed'
  handle: string
  sats: number
  termDays: number
  invoiceId?: string | null
  canVerify?: boolean
  invoiceComment?: string
  paymentRequired?: boolean
}

type TVanityClaimStatus = {
  state: 'pending' | 'settled' | 'failed'
  claimId?: string
  handle?: string
  sats?: number
  expiresAt?: number | null
}

class VanityAddressService {
  static instance: VanityAddressService

  constructor() {
    if (!VanityAddressService.instance) {
      VanityAddressService.instance = this
    }
    return VanityAddressService.instance
  }

  async registerSignupEligibility(): Promise<void> {
    const path = '/v1/nip5/eligibility/register'
    const method = 'POST'
    const url = new URL(path, JUMBLE_API_BASE_URL).toString()
    const auth = await client.signHttpAuth(url, method, 'Register x21 signup eligibility')
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: auth
      },
      body: JSON.stringify({ source: 'x21_signup' })
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error || 'Failed to register signup eligibility')
    }
  }

  async getAccount(): Promise<TVanityAccount> {
    const path = '/v1/nip5/account'
    const method = 'GET'
    const url = new URL(path, JUMBLE_API_BASE_URL).toString()
    const auth = await client.signHttpAuth(url, method, 'View vanity address account')
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: auth
      }
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error || 'Failed to load vanity account')
    }
    return data
  }

  async checkAvailability(name: string): Promise<{
    available: boolean
    reason?: string
    domain?: string
    sats?: number
    ownerPubkey?: string | null
  }> {
    const url = new URL('/v1/nip5/availability', JUMBLE_API_BASE_URL)
    url.searchParams.set('name', name)
    const response = await fetch(url.toString(), { method: 'GET' })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.reason || data.error || 'Failed to check handle availability')
    }
    return data
  }

  async createClaim(name: string): Promise<TVanityClaimCreate> {
    const path = '/v1/nip5/claims'
    const method = 'POST'
    const url = new URL(path, JUMBLE_API_BASE_URL).toString()
    const auth = await client.signHttpAuth(url, method, 'Authorize vanity address claim')
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: auth
      },
      body: JSON.stringify({ name })
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error || 'Failed to create vanity claim')
    }
    return data
  }

  async checkClaim(claimId: string): Promise<TVanityClaimStatus> {
    const url = new URL(`/v1/nip5/claims/${encodeURIComponent(claimId)}/check`, JUMBLE_API_BASE_URL).toString()
    const response = await fetch(url, { method: 'POST' })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error || 'Failed to check claim status')
    }
    return data
  }
}

const instance = new VanityAddressService()
export default instance
