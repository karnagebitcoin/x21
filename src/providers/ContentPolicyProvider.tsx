import { MEDIA_AUTO_LOAD_POLICY } from '@/constants'
import storage from '@/services/local-storage.service'
import { TMediaAutoLoadPolicy } from '@/types'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useUserTrust } from './UserTrustProvider'

type TContentPolicyContext = {
  autoplay: boolean
  setAutoplay: (autoplay: boolean) => void

  defaultShowNsfw: boolean
  setDefaultShowNsfw: (showNsfw: boolean) => void

  hideContentMentioningMutedUsers?: boolean
  setHideContentMentioningMutedUsers?: (hide: boolean) => void

  alwaysHideMutedNotes?: boolean
  setAlwaysHideMutedNotes?: (hide: boolean) => void

  hideNotificationsFromMutedUsers?: boolean
  setHideNotificationsFromMutedUsers?: (hide: boolean) => void

  autoLoadMedia: boolean
  shouldAutoLoadMedia: (pubkey?: string) => boolean
  mediaAutoLoadPolicy: TMediaAutoLoadPolicy
  setMediaAutoLoadPolicy: (policy: TMediaAutoLoadPolicy) => void

  maxHashtags: number
  setMaxHashtags: (max: number) => void

  maxMentions: number
  setMaxMentions: (max: number) => void
}

const ContentPolicyContext = createContext<TContentPolicyContext | undefined>(undefined)

export const useContentPolicy = () => {
  const context = useContext(ContentPolicyContext)
  if (!context) {
    throw new Error('useContentPolicy must be used within an ContentPolicyProvider')
  }
  return context
}

export function ContentPolicyProvider({ children }: { children: React.ReactNode }) {
  const { isUserTrusted, isUserFollowed, trustLevel } = useUserTrust()
  const [autoplay, setAutoplay] = useState(storage.getAutoplay())
  const [defaultShowNsfw, setDefaultShowNsfw] = useState(storage.getDefaultShowNsfw())
  const [hideContentMentioningMutedUsers, setHideContentMentioningMutedUsers] = useState(
    storage.getHideContentMentioningMutedUsers()
  )
  const [alwaysHideMutedNotes, setAlwaysHideMutedNotes] = useState(
    storage.getAlwaysHideMutedNotes()
  )
  const [hideNotificationsFromMutedUsers, setHideNotificationsFromMutedUsers] = useState(
    storage.getHideNotificationsFromMutedUsers()
  )
  const [mediaAutoLoadPolicy, setMediaAutoLoadPolicy] = useState(storage.getMediaAutoLoadPolicy())
  const [maxHashtags, setMaxHashtags] = useState(storage.getMaxHashtags())
  const [maxMentions, setMaxMentions] = useState(storage.getMaxMentions())
  const [connectionType, setConnectionType] = useState((navigator as any).connection?.type)

  useEffect(() => {
    const connection = (navigator as any).connection
    if (!connection) {
      setConnectionType(undefined)
      return
    }
    const handleConnectionChange = () => {
      setConnectionType(connection.type)
    }
    connection.addEventListener('change', handleConnectionChange)
    return () => {
      connection.removeEventListener('change', handleConnectionChange)
    }
  }, [])

  const autoLoadMedia = useMemo(() => {
    if (mediaAutoLoadPolicy === MEDIA_AUTO_LOAD_POLICY.ALWAYS) {
      return true
    }
    if (mediaAutoLoadPolicy === MEDIA_AUTO_LOAD_POLICY.NEVER) {
      return false
    }
    if (mediaAutoLoadPolicy === MEDIA_AUTO_LOAD_POLICY.WIFI_ONLY) {
      return connectionType === 'wifi' || connectionType === 'ethernet'
    }
    // For FOLLOWS_ONLY and WEB_OF_TRUST, we need pubkey
    return false
  }, [mediaAutoLoadPolicy, connectionType])

  // Function to check if media should auto-load based on pubkey
  const shouldAutoLoadMedia = (pubkey?: string) => {
    if (mediaAutoLoadPolicy === MEDIA_AUTO_LOAD_POLICY.ALWAYS) {
      return true
    }
    if (mediaAutoLoadPolicy === MEDIA_AUTO_LOAD_POLICY.NEVER) {
      return false
    }
    if (mediaAutoLoadPolicy === MEDIA_AUTO_LOAD_POLICY.WIFI_ONLY) {
      return connectionType === 'wifi' || connectionType === 'ethernet'
    }
    if (mediaAutoLoadPolicy === MEDIA_AUTO_LOAD_POLICY.FOLLOWS_ONLY) {
      if (!pubkey) return false
      return isUserFollowed(pubkey)
    }
    if (mediaAutoLoadPolicy === MEDIA_AUTO_LOAD_POLICY.WEB_OF_TRUST) {
      if (!pubkey) return false
      return isUserTrusted(pubkey)
    }
    return false
  }

  const updateAutoplay = (autoplay: boolean) => {
    storage.setAutoplay(autoplay)
    setAutoplay(autoplay)
  }

  const updateDefaultShowNsfw = (defaultShowNsfw: boolean) => {
    storage.setDefaultShowNsfw(defaultShowNsfw)
    setDefaultShowNsfw(defaultShowNsfw)
  }

  const updateHideContentMentioningMutedUsers = (hide: boolean) => {
    storage.setHideContentMentioningMutedUsers(hide)
    setHideContentMentioningMutedUsers(hide)
  }

  const updateAlwaysHideMutedNotes = (hide: boolean) => {
    storage.setAlwaysHideMutedNotes(hide)
    setAlwaysHideMutedNotes(hide)
  }

  const updateHideNotificationsFromMutedUsers = (hide: boolean) => {
    storage.setHideNotificationsFromMutedUsers(hide)
    setHideNotificationsFromMutedUsers(hide)
  }

  const updateMediaAutoLoadPolicy = (policy: TMediaAutoLoadPolicy) => {
    storage.setMediaAutoLoadPolicy(policy)
    setMediaAutoLoadPolicy(policy)
  }

  const updateMaxHashtags = (max: number) => {
    storage.setMaxHashtags(max)
    setMaxHashtags(max)
  }

  const updateMaxMentions = (max: number) => {
    storage.setMaxMentions(max)
    setMaxMentions(max)
  }

  return (
    <ContentPolicyContext.Provider
      value={{
        autoplay,
        setAutoplay: updateAutoplay,
        defaultShowNsfw,
        setDefaultShowNsfw: updateDefaultShowNsfw,
        hideContentMentioningMutedUsers,
        setHideContentMentioningMutedUsers: updateHideContentMentioningMutedUsers,
        alwaysHideMutedNotes,
        setAlwaysHideMutedNotes: updateAlwaysHideMutedNotes,
        hideNotificationsFromMutedUsers,
        setHideNotificationsFromMutedUsers: updateHideNotificationsFromMutedUsers,
        autoLoadMedia,
        shouldAutoLoadMedia,
        mediaAutoLoadPolicy,
        setMediaAutoLoadPolicy: updateMediaAutoLoadPolicy,
        maxHashtags,
        setMaxHashtags: updateMaxHashtags,
        maxMentions,
        setMaxMentions: updateMaxMentions
      }}
    >
      {children}
    </ContentPolicyContext.Provider>
  )
}
