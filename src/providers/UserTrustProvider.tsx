import client from '@/services/client.service'
import storage from '@/services/local-storage.service'
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useNostr } from './NostrProvider'

type TUserTrustContext = {
  hideUntrustedInteractions: boolean
  hideUntrustedNotifications: boolean
  hideUntrustedNotes: boolean
  trustLevel: number
  updateHideUntrustedInteractions: (hide: boolean) => void
  updateHideUntrustedNotifications: (hide: boolean) => void
  updateHideUntrustedNotes: (hide: boolean) => void
  updateTrustLevel: (level: number) => void
  isUserTrusted: (pubkey: string) => boolean
  isUserFollowed: (pubkey: string) => boolean
}

const UserTrustContext = createContext<TUserTrustContext | undefined>(undefined)

export const useUserTrust = () => {
  const context = useContext(UserTrustContext)
  if (!context) {
    throw new Error('useUserTrust must be used within a UserTrustProvider')
  }
  return context
}

const wotSet = new Set<string>()
const followsSet = new Set<string>()

export function UserTrustProvider({ children }: { children: React.ReactNode }) {
  const { pubkey: currentPubkey } = useNostr()
  const [hideUntrustedInteractions, setHideUntrustedInteractions] = useState(() =>
    storage.getHideUntrustedInteractions()
  )
  const [hideUntrustedNotifications, setHideUntrustedNotifications] = useState(() =>
    storage.getHideUntrustedNotifications()
  )
  const [hideUntrustedNotes, setHideUntrustedNotes] = useState(() =>
    storage.getHideUntrustedNotes()
  )
  const [trustLevel, setTrustLevel] = useState(() => storage.getTrustLevel())

  useEffect(() => {
    if (!currentPubkey) return

    const initWoT = async () => {
      // Clear previous data
      wotSet.clear()
      followsSet.clear()

      const followings = await client.fetchFollowings(currentPubkey)
      followings.forEach((pubkey) => {
        followsSet.add(pubkey)
        wotSet.add(pubkey)
      })

      const batchSize = 20
      for (let i = 0; i < followings.length; i += batchSize) {
        const batch = followings.slice(i, i + batchSize)
        await Promise.allSettled(
          batch.map(async (pubkey) => {
            const _followings = await client.fetchFollowings(pubkey)
            _followings.forEach((following) => {
              wotSet.add(following)
            })
          })
        )
        await new Promise((resolve) => setTimeout(resolve, 200))
      }
    }
    initWoT()
  }, [currentPubkey])

  const isUserFollowed = useCallback(
    (pubkey: string) => {
      if (!currentPubkey) return false
      return followsSet.has(pubkey)
    },
    [currentPubkey]
  )

  const isUserTrusted = useCallback(
    (pubkey: string) => {
      if (!currentPubkey || pubkey === currentPubkey) return true

      // Trust levels:
      // 0: Everyone (show all)
      // 1: Network + Follows (WoT - people you follow + people they follow)
      // 2: Follows only (only people you directly follow)
      // 3: You only (only your own posts)

      switch (trustLevel) {
        case 0:
          return true
        case 1:
          return wotSet.has(pubkey)
        case 2:
          return followsSet.has(pubkey)
        case 3:
          return false // Only show own posts (already handled above)
        default:
          return wotSet.has(pubkey)
      }
    },
    [currentPubkey, trustLevel]
  )

  const updateHideUntrustedInteractions = (hide: boolean) => {
    setHideUntrustedInteractions(hide)
    storage.setHideUntrustedInteractions(hide)
  }

  const updateHideUntrustedNotifications = (hide: boolean) => {
    setHideUntrustedNotifications(hide)
    storage.setHideUntrustedNotifications(hide)
  }

  const updateHideUntrustedNotes = (hide: boolean) => {
    setHideUntrustedNotes(hide)
    storage.setHideUntrustedNotes(hide)
  }

  const updateTrustLevel = (level: number) => {
    setTrustLevel(level)
    storage.setTrustLevel(level)
  }

  return (
    <UserTrustContext.Provider
      value={{
        hideUntrustedInteractions,
        hideUntrustedNotifications,
        hideUntrustedNotes,
        trustLevel,
        updateHideUntrustedInteractions,
        updateHideUntrustedNotifications,
        updateHideUntrustedNotes,
        updateTrustLevel,
        isUserTrusted,
        isUserFollowed
      }}
    >
      {children}
    </UserTrustContext.Provider>
  )
}
