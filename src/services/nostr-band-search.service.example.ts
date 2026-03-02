/**
 * NostrBandSearchService Usage Examples
 * 
 * This file demonstrates how to use the nostr-band-search service
 * to construct search URLs programmatically.
 */

import nostrBandSearchService from './nostr-band-search.service'

// ============================================================================
// EXAMPLE 1: Basic text search
// ============================================================================
const example1 = () => {
  const url = nostrBandSearchService.buildSearchUrl({
    query: 'bitcoin'
  })
  console.log('Search for bitcoin:', url)
  // Output: https://nostr.band/?q=bitcoin
}

// ============================================================================
// EXAMPLE 2: Search by specific author
// ============================================================================
const example2 = () => {
  const url = nostrBandSearchService.buildSearchUrl({
    query: 'nostr developers',
    author: 'npub1r0rs5q2gk0e3dk3nlc7gnu378ec6cnlenqp8a3cjhyzu6f8k5sgs4sq9ac'
  })
  console.log('Search by author:', url)
  // Output: https://nostr.band/?q=nostr+developers+by:npub1r0rs5q2gk0e3dk3nlc7gnu378ec6cnlenqp8a3cjhyzu6f8k5sgs4sq9ac
}

// ============================================================================
// EXAMPLE 3: Search for specific event kind
// ============================================================================
const example3 = () => {
  const url = nostrBandSearchService.buildSearchUrl({
    query: 'privacy',
    kind: 30023 // Long-form articles
  })
  console.log('Search for articles:', url)
  // Output: https://nostr.band/?q=privacy+kind:30023
}

// ============================================================================
// EXAMPLE 4: Search with date range
// ============================================================================
const example4 = () => {
  const since = Math.floor(new Date('2024-01-01').getTime() / 1000)
  const until = Math.floor(new Date('2024-12-31').getTime() / 1000)
  
  const url = nostrBandSearchService.buildSearchUrl({
    query: 'bitcoin',
    since,
    until
  })
  console.log('Search with date range:', url)
  // Output: https://nostr.band/?q=bitcoin+since:2024-01-01+until:2024-12-31
}

// ============================================================================
// EXAMPLE 5: Combined filters
// ============================================================================
const example5 = () => {
  const url = nostrBandSearchService.buildSearchUrl({
    query: 'lightning network',
    author: 'npub1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z',
    kind: 1, // Regular notes
    since: Math.floor(new Date('2024-10-01').getTime() / 1000),
    limit: 50
  })
  console.log('Complex search:', url)
  // Output: https://nostr.band/?q=lightning+network+by:npub1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z+kind:1+since:2024-10-01&limit=50
}

// ============================================================================
// EXAMPLE 6: Search multiple kinds
// ============================================================================
const example6 = () => {
  const url = nostrBandSearchService.buildSearchUrl({
    query: 'nostr',
    kind: [1, 6, 7] // Notes, reposts, and reactions
  })
  console.log('Multi-kind search:', url)
  // Output: https://nostr.band/?q=nostr+kind:1+kind:6+kind:7
}

// ============================================================================
// EXAMPLE 7: Author-only search (all content from user)
// ============================================================================
const example7 = () => {
  const url = nostrBandSearchService.buildSearchUrl({
    author: 'npub1r0rs5q2gk0e3dk3nlc7gnu378ec6cnlenqp8a3cjhyzu6f8k5sgs4sq9ac'
  })
  console.log('All content from author:', url)
  // Output: https://nostr.band/?q=by:npub1r0rs5q2gk0e3dk3nlc7gnu378ec6cnlenqp8a3cjhyzu6f8k5sgs4sq9ac
}

// ============================================================================
// EXAMPLE 8: Recent content (last 7 days)
// ============================================================================
const example8 = () => {
  const sevenDaysAgo = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000)
  
  const url = nostrBandSearchService.buildSearchUrl({
    query: 'bitcoin',
    since: sevenDaysAgo
  })
  console.log('Recent bitcoin notes:', url)
  // Output: https://nostr.band/?q=bitcoin+since:2024-10-22
}

// ============================================================================
// EXAMPLE 9: Using hex pubkey (auto-converts to npub)
// ============================================================================
const example9 = () => {
  const url = nostrBandSearchService.buildSearchUrl({
    query: 'hello',
    author: '1f4c1ed244c84a2b36172bbc4cf470e50aa42d66541acb450bc0640c56baa38a' // Hex format
  })
  console.log('Search with hex pubkey:', url)
  // Output: https://nostr.band/?q=hello+by:npub1r0rs5q2gk0e3dk3nlc7gnu378ec6cnlenqp8a3cjhyzu6f8k5sgs4sq9ac
}

// ============================================================================
// EXAMPLE 10: Zap search
// ============================================================================
const example10 = () => {
  const url = nostrBandSearchService.buildSearchUrl({
    kind: 9735, // Zap events
    since: Math.floor(new Date('2024-10-01').getTime() / 1000)
  })
  console.log('Recent zaps:', url)
  // Output: https://nostr.band/?q=kind:9735+since:2024-10-01
}

// ============================================================================
// COMMON EVENT KINDS REFERENCE
// ============================================================================
const eventKinds = {
  METADATA: 0,           // User profile
  TEXT_NOTE: 1,          // Regular note/post
  CONTACTS: 3,           // Following list
  ENCRYPTED_DM: 4,       // Direct message
  DELETE: 5,             // Delete event
  REPOST: 6,             // Repost/boost
  REACTION: 7,           // Like/reaction
  ZAP: 9735,            // Lightning zap
  LONG_FORM: 30023,     // Article
  DRAFT_LONG_FORM: 30024, // Draft article
}

// ============================================================================
// UTILITY: Build URL for common searches
// ============================================================================

/**
 * Search user's own notes about a topic
 */
export const searchMyNotes = (query: string, userPubkey: string) => {
  return nostrBandSearchService.buildSearchUrl({
    query,
    author: userPubkey,
    kind: 1
  })
}

/**
 * Search for articles about a topic
 */
export const searchArticles = (query: string, since?: number) => {
  return nostrBandSearchService.buildSearchUrl({
    query,
    kind: 30023,
    since
  })
}

/**
 * Search for recent content (last N days)
 */
export const searchRecent = (query: string, days: number = 7) => {
  const since = Math.floor((Date.now() - days * 24 * 60 * 60 * 1000) / 1000)
  return nostrBandSearchService.buildSearchUrl({
    query,
    since
  })
}

/**
 * Search all content from a user
 */
export const searchUserContent = (userPubkey: string, kind?: number) => {
  return nostrBandSearchService.buildSearchUrl({
    author: userPubkey,
    kind
  })
}

/**
 * Search for zaps related to a topic
 */
export const searchZaps = (query?: string, since?: number) => {
  return nostrBandSearchService.buildSearchUrl({
    query,
    kind: 9735,
    since
  })
}

// ============================================================================
// Run all examples (for testing)
// ============================================================================
export const runAllExamples = () => {
  console.log('=== NostrBandSearchService Examples ===\n')
  
  example1()
  example2()
  example3()
  example4()
  example5()
  example6()
  example7()
  example8()
  example9()
  example10()
  
  console.log('\n=== Utility Functions ===\n')
  
  console.log('My notes about bitcoin:')
  console.log(searchMyNotes('bitcoin', 'npub1r0rs5q2gk0e3dk3nlc7gnu378ec6cnlenqp8a3cjhyzu6f8k5sgs4sq9ac'))
  
  console.log('\nRecent privacy articles:')
  console.log(searchArticles('privacy', Math.floor(new Date('2024-10-01').getTime() / 1000)))
  
  console.log('\nContent from last 3 days:')
  console.log(searchRecent('nostr', 3))
  
  console.log('\nAll content from user:')
  console.log(searchUserContent('npub1r0rs5q2gk0e3dk3nlc7gnu378ec6cnlenqp8a3cjhyzu6f8k5sgs4sq9ac'))
  
  console.log('\nRecent zaps:')
  console.log(searchZaps(undefined, Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000)))
}

// Uncomment to run:
// runAllExamples()
