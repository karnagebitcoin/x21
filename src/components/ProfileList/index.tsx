import { useEffect, useRef, useState, useMemo } from 'react'
import UserItem from '../UserItem'
import { useFetchProfile, TLastActivityData } from '@/hooks'

export default function ProfileList({
  pubkeys,
  compactFollowButton,
  searchQuery,
  activityMap,
  showLastActivity
}: {
  pubkeys: string[]
  compactFollowButton?: boolean
  searchQuery?: string
  activityMap?: Map<string, TLastActivityData>
  showLastActivity?: boolean
}) {
  const [visiblePubkeys, setVisiblePubkeys] = useState<string[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setVisiblePubkeys(pubkeys.slice(0, 10))
  }, [pubkeys])

  useEffect(() => {
    const options = {
      root: null,
      rootMargin: '10px',
      threshold: 1
    }

    const observerInstance = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && pubkeys.length > visiblePubkeys.length) {
        setVisiblePubkeys((prev) => [...prev, ...pubkeys.slice(prev.length, prev.length + 10)])
      }
    }, options)

    const currentBottomRef = bottomRef.current
    if (currentBottomRef) {
      observerInstance.observe(currentBottomRef)
    }

    return () => {
      if (observerInstance && currentBottomRef) {
        observerInstance.unobserve(currentBottomRef)
      }
    }
  }, [visiblePubkeys, pubkeys])

  return (
    <div className="px-4 pt-2">
      {visiblePubkeys.map((pubkey, index) => (
        <FilteredUserItem
          key={`${index}-${pubkey}`}
          pubkey={pubkey}
          compactFollowButton={compactFollowButton}
          searchQuery={searchQuery}
          activityData={activityMap?.get(pubkey)}
          showLastActivity={showLastActivity}
        />
      ))}
      {pubkeys.length > visiblePubkeys.length && <div ref={bottomRef} />}
    </div>
  )
}

// Wrapper component that handles filtering logic
function FilteredUserItem({
  pubkey,
  compactFollowButton,
  searchQuery,
  activityData,
  showLastActivity
}: {
  pubkey: string
  compactFollowButton?: boolean
  searchQuery?: string
  activityData?: TLastActivityData
  showLastActivity?: boolean
}) {
  const { profile } = useFetchProfile(pubkey)

  // Only filter if there's a search query
  const shouldShow = useMemo(() => {
    if (!searchQuery || searchQuery.trim() === '') {
      return true
    }

    if (!profile) {
      return false // Don't show until profile loads when searching
    }

    const query = searchQuery.toLowerCase()
    const username = profile.username?.toLowerCase() || ''
    const originalUsername = profile.original_username?.toLowerCase() || ''
    const nip05 = profile.nip05?.toLowerCase() || ''
    const about = profile.about?.toLowerCase() || ''

    return (
      username.includes(query) ||
      originalUsername.includes(query) ||
      nip05.includes(query) ||
      about.includes(query) ||
      pubkey.toLowerCase().includes(query)
    )
  }, [profile, searchQuery, pubkey])

  if (!shouldShow) {
    return null
  }

  return (
    <UserItem
      pubkey={pubkey}
      compactFollowButton={compactFollowButton}
      activityData={activityData}
      showLastActivity={showLastActivity}
    />
  )
}
