/**
 * Nostr.band Search Service
 * Provides utilities for constructing and executing nostr.band search queries
 */

import { nip19 } from 'nostr-tools'

export type NostrBandSearchParams = {
  query?: string
  author?: string // npub or hex pubkey
  kind?: number | number[]
  since?: number
  until?: number
  limit?: number
}

class NostrBandSearchService {
  private readonly BASE_URL = 'https://nostr.band'

  /**
   * Constructs a nostr.band search URL with the given parameters
   */
  buildSearchUrl(params: NostrBandSearchParams): string {
    const searchParams = new URLSearchParams()

    // Build the query string
    let queryParts: string[] = []

    if (params.query) {
      queryParts.push(params.query)
    }

    if (params.author) {
      // Convert hex pubkey to npub if needed
      const npub = params.author.startsWith('npub')
        ? params.author
        : nip19.npubEncode(params.author)
      queryParts.push(`by:${npub}`)
    }

    if (params.kind) {
      const kinds = Array.isArray(params.kind) ? params.kind : [params.kind]
      kinds.forEach(k => queryParts.push(`kind:${k}`))
    }

    if (params.since) {
      const date = new Date(params.since * 1000).toISOString().split('T')[0]
      queryParts.push(`since:${date}`)
    }

    if (params.until) {
      const date = new Date(params.until * 1000).toISOString().split('T')[0]
      queryParts.push(`until:${date}`)
    }

    if (queryParts.length > 0) {
      searchParams.set('q', queryParts.join(' '))
    }

    if (params.limit) {
      searchParams.set('limit', params.limit.toString())
    }

    const queryString = searchParams.toString()
    return queryString ? `${this.BASE_URL}/?${queryString}` : this.BASE_URL
  }

  /**
   * Parses a natural language search request and returns nostr.band URL
   */
  parseNaturalLanguageSearch(text: string, userPubkey?: string): string | null {
    const lowerText = text.toLowerCase()

    // Check if this looks like a search request
    if (
      !lowerText.includes('search') &&
      !lowerText.includes('find') &&
      !lowerText.includes('look for') &&
      !lowerText.includes('show me')
    ) {
      return null
    }

    const params: NostrBandSearchParams = {}

    // Extract author mentions (npub or "by X")
    const npubMatch = text.match(/npub1[a-z0-9]{58,}/i)
    if (npubMatch) {
      params.author = npubMatch[0]
    }

    // Look for "by [author]" pattern
    const byMatch = text.match(/\bby:?\s*(\S+)/i)
    if (byMatch && !npubMatch) {
      // This might be a name - we can't resolve it here, but we can pass it through
      // The AI should handle resolving names to npubs
      return null // Let AI handle this case
    }

    // Extract kind filters
    const kindMatch = text.match(/\bkind:?\s*(\d+)/i)
    if (kindMatch) {
      params.kind = parseInt(kindMatch[1])
    }

    // Extract time ranges
    const sinceMatch = text.match(/\bsince:?\s*(\d{4}-\d{2}-\d{2})/i)
    if (sinceMatch) {
      params.since = Math.floor(new Date(sinceMatch[1]).getTime() / 1000)
    }

    const untilMatch = text.match(/\buntil:?\s*(\d{4}-\d{2}-\d{2})/i)
    if (untilMatch) {
      params.until = Math.floor(new Date(untilMatch[1]).getTime() / 1000)
    }

    // Extract the main search query (remove special parameters)
    let query = text
      .replace(/\bby:?\s*\S+/gi, '')
      .replace(/\bkind:?\s*\d+/gi, '')
      .replace(/\bsince:?\s*\d{4}-\d{2}-\d{2}/gi, '')
      .replace(/\buntil:?\s*\d{4}-\d{2}-\d{2}/gi, '')
      .replace(/npub1[a-z0-9]{58,}/gi, '')
      .replace(/\b(search|find|look for|show me)\b/gi, '')
      .trim()

    if (query) {
      params.query = query
    }

    // If we have any parameters, build the URL
    if (Object.keys(params).length > 0) {
      return this.buildSearchUrl(params)
    }

    return null
  }

  /**
   * Extracts note IDs from nostr.band search results HTML
   * Note: This would require the AI to fetch and parse the HTML
   */
  extractNoteIdsFromHtml(html: string): string[] {
    const noteIds: string[] = []
    
    // Match note1... (bech32) identifiers
    const note1Matches = html.match(/note1[a-z0-9]{58,}/gi)
    if (note1Matches) {
      noteIds.push(...note1Matches)
    }

    // Match nevent1... identifiers
    const neventMatches = html.match(/nevent1[a-z0-9]+/gi)
    if (neventMatches) {
      noteIds.push(...neventMatches)
    }

    return [...new Set(noteIds)] // Remove duplicates
  }
}

const nostrBandSearchService = new NostrBandSearchService()
export default nostrBandSearchService
