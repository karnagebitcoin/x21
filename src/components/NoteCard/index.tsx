import { Skeleton } from '@/components/ui/skeleton'
import { isMentioningMutedUsers, isFromMutedDomain } from '@/lib/event'
import { useContentPolicy } from '@/providers/ContentPolicyProvider'
import { useMuteList } from '@/providers/MuteListProvider'
import { useFetchProfile } from '@/hooks'
import { Event, kinds } from 'nostr-tools'
import { useMemo } from 'react'
import MainNoteCard from './MainNoteCard'
import RepostNoteCard from './RepostNoteCard'

export default function NoteCard({
  event,
  className,
  filterMutedNotes = true,
  pinned = false,
  hideSeparator = false,
  onTagsChange,
  bookmarkId
}: {
  event: Event
  className?: string
  filterMutedNotes?: boolean
  pinned?: boolean
  hideSeparator?: boolean
  onTagsChange?: () => void
  bookmarkId?: string
}) {
  const { mutePubkeySet, getMutedWords, getMutedDomains } = useMuteList()
  const { hideContentMentioningMutedUsers } = useContentPolicy()
  const mutedWords = useMemo(() => getMutedWords(), [getMutedWords])
  const mutedDomains = useMemo(() => getMutedDomains(), [getMutedDomains])
  const { profile, isFetching } = useFetchProfile(event?.pubkey)

  // Safety check: ensure event is valid
  if (!event || !event.pubkey) {
    return null
  }

  const shouldHide = useMemo(() => {
    // If we have muted domains configured and profile is still loading, wait for profile to load
    if (filterMutedNotes && mutedDomains.length > 0 && isFetching) {
      return true
    }

    if (filterMutedNotes && mutePubkeySet.has(event.pubkey)) {
      return true
    }

    // Check if author is muted by NIP-05 domain
    if (filterMutedNotes && profile && isFromMutedDomain(profile.nip05, mutedDomains)) {
      return true
    }

    if (hideContentMentioningMutedUsers && isMentioningMutedUsers(event, mutePubkeySet)) {
      return true
    }

    // Check for muted words in content and username
    if (filterMutedNotes && mutedWords.length > 0) {
      const content = event.content.toLowerCase()
      const username = profile?.username?.toLowerCase() || ''

      if (mutedWords.some(word => {
        const lowerWord = word.toLowerCase()
        return content.includes(lowerWord) || username.includes(lowerWord)
      })) {
        return true
      }
    }

    return false
  }, [event, filterMutedNotes, mutePubkeySet, mutedWords, hideContentMentioningMutedUsers, profile, mutedDomains, isFetching])

  if (shouldHide) return null

  if (event.kind === kinds.Repost) {
    return (
      <RepostNoteCard
        event={event}
        className={className}
        filterMutedNotes={filterMutedNotes}
        pinned={pinned}
        hideSeparator={hideSeparator}
        onTagsChange={onTagsChange}
        bookmarkId={bookmarkId}
      />
    )
  }
  return <MainNoteCard event={event} className={className} pinned={pinned} hideSeparator={hideSeparator} onTagsChange={onTagsChange} bookmarkId={bookmarkId} filterMutedNotes={filterMutedNotes} />
}

export function NoteCardLoadingSkeleton() {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center space-x-2">
        <Skeleton className="w-10 h-10 rounded-full" />
        <div className={`flex-1 w-0`}>
          <div className="py-1">
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="py-0.5">
            <Skeleton className="h-3 w-12" />
          </div>
        </div>
      </div>
      <div className="pt-2">
        <div className="my-1">
          <Skeleton className="w-full h-4 my-1 mt-2" />
        </div>
        <div className="my-1">
          <Skeleton className="w-2/3 h-4 my-1" />
        </div>
      </div>
    </div>
  )
}
