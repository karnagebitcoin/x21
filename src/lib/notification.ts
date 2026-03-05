import { kinds, NostrEvent } from 'nostr-tools'
import { hasMutedHashtag, isMentioningMutedUsers, isFromMutedDomain } from './event'
import { tagNameEquals } from './tag'
import { TProfile } from '@/types'

export function notificationFilter(
  event: NostrEvent,
  {
    pubkey,
    mutePubkeySet,
    hideContentMentioningMutedUsers,
    hideNotificationsFromMutedUsers,
    hideUntrustedNotifications,
    isUserTrusted,
    mutedDomains,
    mutedWords,
    mutedTags,
    getProfile
  }: {
    pubkey?: string | null
    mutePubkeySet: Set<string>
    hideContentMentioningMutedUsers?: boolean
    hideNotificationsFromMutedUsers?: boolean
    hideUntrustedNotifications?: boolean
    isUserTrusted: (pubkey: string) => boolean
    mutedDomains?: string[]
    mutedWords?: string[]
    mutedTags?: string[]
    getProfile?: (pubkey: string) => TProfile | null | undefined
  }
): boolean {
  // For zap events, the actual sender is in the 'P' tag, not event.pubkey
  let senderPubkey = event.pubkey
  if (event.kind === kinds.Zap) {
    const zapSenderTag = event.tags.find(tagNameEquals('P'))
    if (zapSenderTag) {
      senderPubkey = zapSenderTag[1]
    }
  }

  // Check if sender is muted by domain
  if (hideNotificationsFromMutedUsers && mutedDomains && mutedDomains.length > 0 && getProfile) {
    const profile = getProfile(senderPubkey)
    if (profile && isFromMutedDomain(profile.nip05, mutedDomains)) {
      return false
    }
  }

  if (
    (hideNotificationsFromMutedUsers && mutePubkeySet.has(senderPubkey)) ||
    (hideContentMentioningMutedUsers && isMentioningMutedUsers(event, mutePubkeySet)) ||
    (hideUntrustedNotifications && !isUserTrusted(senderPubkey))
  ) {
    return false
  }

  if (mutedTags && mutedTags.length > 0 && hasMutedHashtag(event, mutedTags)) {
    return false
  }

  // Check for muted words in content and username
  if (mutedWords && mutedWords.length > 0) {
    const content = event.content?.toLowerCase() || ''
    const profile = getProfile ? getProfile(senderPubkey) : null
    const username = profile?.username?.toLowerCase() || ''

    if (mutedWords.some(word => {
      const wordLower = word.toLowerCase()
      return content.includes(wordLower) || username.includes(wordLower)
    })) {
      return false
    }
  }

  if (pubkey && event.kind === kinds.Reaction) {
    const targetPubkey = event.tags.findLast(tagNameEquals('p'))?.[1]
    if (targetPubkey !== pubkey) return false
  }

  return true
}
