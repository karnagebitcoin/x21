import { ExtendedKind } from '@/constants'
import { notificationFilter } from '@/lib/notification'
import { useContentPolicy } from '@/providers/ContentPolicyProvider'
import { useMuteList } from '@/providers/MuteListProvider'
import { useNostr } from '@/providers/NostrProvider'
import { useUserTrust } from '@/providers/UserTrustProvider'
import client from '@/services/client.service'
import { Event, kinds } from 'nostr-tools'
import { useMemo } from 'react'
import { MentionNotification } from './MentionNotification'
import { PollResponseNotification } from './PollResponseNotification'
import { ReactionNotification } from './ReactionNotification'
import { RepostNotification } from './RepostNotification'
import { ZapNotification } from './ZapNotification'

export function NotificationItem({
  notification,
  isNew = false
}: {
  notification: Event
  isNew?: boolean
}) {
  const { pubkey } = useNostr()
  const { mutePubkeySet, getMutedDomains, getMutedWords, getMutedTags } = useMuteList()
  const { hideContentMentioningMutedUsers, hideNotificationsFromMutedUsers } = useContentPolicy()
  const { hideUntrustedNotifications, isUserTrusted } = useUserTrust()
  const mutedDomains = getMutedDomains()
  const mutedWords = getMutedWords()
  const mutedTags = getMutedTags()
  const canShow = useMemo(() => {
    return notificationFilter(notification, {
      pubkey,
      mutePubkeySet,
      hideContentMentioningMutedUsers,
      hideNotificationsFromMutedUsers,
      hideUntrustedNotifications,
      isUserTrusted,
      mutedDomains,
      mutedWords,
      mutedTags,
      getProfile: (pubkey: string) => client.getCachedProfile(pubkey)
    })
  }, [
    notification,
    mutePubkeySet,
    hideContentMentioningMutedUsers,
    hideNotificationsFromMutedUsers,
    hideUntrustedNotifications,
    isUserTrusted,
    mutedDomains,
    mutedWords,
    mutedTags
  ])
  if (!canShow) return null

  if (notification.kind === kinds.Reaction) {
    return <ReactionNotification notification={notification} isNew={isNew} />
  }
  if (
    notification.kind === kinds.ShortTextNote ||
    notification.kind === ExtendedKind.COMMENT ||
    notification.kind === ExtendedKind.VOICE_COMMENT ||
    notification.kind === ExtendedKind.POLL
  ) {
    return <MentionNotification notification={notification} isNew={isNew} />
  }
  if (notification.kind === kinds.Repost) {
    return <RepostNotification notification={notification} isNew={isNew} />
  }
  if (notification.kind === kinds.Zap) {
    return <ZapNotification notification={notification} isNew={isNew} />
  }
  if (notification.kind === ExtendedKind.POLL_RESPONSE) {
    return <PollResponseNotification notification={notification} isNew={isNew} />
  }
  return null
}
