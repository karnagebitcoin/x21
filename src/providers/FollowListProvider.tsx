import { createFollowListDraftEvent } from '@/lib/draft-event'
import { getPubkeysFromPTags } from '@/lib/tag'
import client from '@/services/client.service'
import { createContext, useContext, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNostr } from './NostrProvider'

type TFollowListContext = {
  followings: string[]
  follow: (pubkey: string) => Promise<void>
  followMultiple: (pubkeys: string[]) => Promise<void>
  unfollow: (pubkey: string) => Promise<void>
}

const FollowListContext = createContext<TFollowListContext | undefined>(undefined)

export const useFollowList = () => {
  const context = useContext(FollowListContext)
  if (!context) {
    throw new Error('useFollowList must be used within a FollowListProvider')
  }
  return context
}

export function FollowListProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation()
  const { pubkey: accountPubkey, followListEvent, publish, updateFollowListEvent } = useNostr()
  const followings = useMemo(
    () => (followListEvent ? getPubkeysFromPTags(followListEvent.tags) : []),
    [followListEvent]
  )

  const follow = async (pubkey: string) => {
    if (!accountPubkey) return

    const followListEvent = await client.fetchFollowListEvent(accountPubkey)
    if (!followListEvent) {
      const result = confirm(t('FollowListNotFoundConfirmation'))

      if (!result) {
        return
      }
    }
    const newFollowListDraftEvent = createFollowListDraftEvent(
      (followListEvent?.tags ?? []).concat([['p', pubkey]]),
      followListEvent?.content
    )
    const newFollowListEvent = await publish(newFollowListDraftEvent)
    await updateFollowListEvent(newFollowListEvent)
  }

  const followMultiple = async (pubkeys: string[]) => {
    if (!accountPubkey || pubkeys.length === 0) return

    const followListEvent = await client.fetchFollowListEvent(accountPubkey)
    if (!followListEvent) {
      const result = confirm(t('FollowListNotFoundConfirmation'))

      if (!result) {
        return
      }
    }

    // Get existing p tags
    const existingPubkeys = followListEvent?.tags
      .filter(([tagName]) => tagName === 'p')
      .map(([, pubkey]) => pubkey) || []

    // Filter out already followed pubkeys
    const newPubkeys = pubkeys.filter(pk => !existingPubkeys.includes(pk))

    if (newPubkeys.length === 0) {
      return // All already followed
    }

    // Create new p tags for new pubkeys
    const newPTags = newPubkeys.map(pk => ['p', pk] as [string, string])

    // Combine existing tags with new p tags
    const newFollowListDraftEvent = createFollowListDraftEvent(
      (followListEvent?.tags ?? []).concat(newPTags),
      followListEvent?.content
    )
    const newFollowListEvent = await publish(newFollowListDraftEvent)
    await updateFollowListEvent(newFollowListEvent)
  }

  const unfollow = async (pubkey: string) => {
    if (!accountPubkey) return

    const followListEvent = await client.fetchFollowListEvent(accountPubkey)
    if (!followListEvent) return

    const newFollowListDraftEvent = createFollowListDraftEvent(
      followListEvent.tags.filter(([tagName, tagValue]) => tagName !== 'p' || tagValue !== pubkey),
      followListEvent.content
    )
    const newFollowListEvent = await publish(newFollowListDraftEvent)
    await updateFollowListEvent(newFollowListEvent)
  }

  return (
    <FollowListContext.Provider
      value={{
        followings,
        follow,
        followMultiple,
        unfollow
      }}
    >
      {children}
    </FollowListContext.Provider>
  )
}
