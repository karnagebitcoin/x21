import { JUMBLE_API_BASE_URL } from '@/constants'

type TTopUpQuotePackage = {
  characters: number
  sats: number
  estimatedUsdCost: number
}

type TTopUpQuote = {
  model: string
  priceSource: 'coingecko' | 'fallback'
  btcUsd: number
  fallbackBtcUsd: number
  marginMultiplier: number
  packages: TTopUpQuotePackage[]
}

class TransactionService {
  static instance: TransactionService

  constructor() {
    if (!TransactionService.instance) {
      TransactionService.instance = this
    }
    return TransactionService.instance
  }

  async createTransaction(
    pubkey: string,
    characters: number
  ): Promise<{
    transactionId: string
    invoiceId: string
    sats: number
    characters: number
    canVerify: boolean
    invoiceComment: string
  }> {
    const url = new URL('/v1/transactions', JUMBLE_API_BASE_URL).toString()
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        pubkey,
        characters,
        purpose: 'translation'
      })
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error ?? 'Failed to create transaction')
    }
    return data
  }

  async getTranslationTopUpQuote(): Promise<TTopUpQuote> {
    const url = new URL('/v1/transactions/quote', JUMBLE_API_BASE_URL).toString()
    const response = await fetch(url, {
      method: 'GET'
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error ?? 'Failed to fetch top-up quote')
    }
    return data
  }

  async checkTransaction(transactionId: string): Promise<{
    state: 'pending' | 'failed' | 'settled'
    canVerify?: boolean
  }> {
    const url = new URL(`/v1/transactions/${transactionId}/check`, JUMBLE_API_BASE_URL).toString()
    const response = await fetch(url, {
      method: 'POST'
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error ?? 'Failed to complete transaction')
    }
    return data
  }

  async confirmTransaction(
    transactionId: string,
    preimage: string
  ): Promise<{
    state: 'pending' | 'failed' | 'settled'
    canVerify?: boolean
  }> {
    const url = new URL(`/v1/transactions/${transactionId}/confirm`, JUMBLE_API_BASE_URL).toString()
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ preimage })
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error ?? 'Failed to confirm transaction')
    }
    return data
  }
}

const instance = new TransactionService()
export default instance
