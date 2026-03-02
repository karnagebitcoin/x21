import { Separator } from '@/components/ui/separator'
import { isMentioningMutedUsers, isFromMutedDomain } from '@/lib/event'
import { tagNameEquals } from '@/lib/tag'
import { useFetchProfile } from '@/hooks'
import { useContentPolicy } from '@/providers/ContentPolicyProvider'
import { useMuteList } from '@/providers/MuteListProvider'
import client from '@/services/client.service'
import { Event, kinds, nip19, verifyEvent } from 'nostr-tools'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import MainNoteCard from './MainNoteCard'
import RepostDescription from './RepostDescription'

export default function RepostNoteCard({
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
  const { t } = useTranslation()
  const { mutePubkeySet, getMutedDomains } = useMuteList()
  const { hideContentMentioningMutedUsers, alwaysHideMutedNotes } = useContentPolicy()
  const [targetEvent, setTargetEvent] = useState<Event | null>(null)
  const { profile, isFetching } = useFetchProfile(targetEvent?.pubkey)
  const mutedDomains = getMutedDomains()
  const isMutedByPubkey = useMemo(() => {
    return targetEvent && filterMutedNotes && mutePubkeySet.has(targetEvent.pubkey)
  }, [targetEvent, filterMutedNotes, mutePubkeySet])
  const isMutedByDomain = useMemo(() => {
    return targetEvent && filterMutedNotes && profile && isFromMutedDomain(profile.nip05, mutedDomains)
  }, [targetEvent, filterMutedNotes, profile, mutedDomains])
  const shouldHide = useMemo(() => {
    if (!targetEvent) return true
    // If we have muted domains and profile is loading, hide while we check
    if (filterMutedNotes && mutedDomains.length > 0 && isFetching) {
      return true
    }
    // Always hide domain-muted content
    if (isMutedByDomain) {
      return true
    }
    // Hide pubkey-muted content only if alwaysHideMutedNotes is disabled
    if (isMutedByPubkey && !alwaysHideMutedNotes) {
      return true
    }
    if (hideContentMentioningMutedUsers && isMentioningMutedUsers(targetEvent, mutePubkeySet)) {
      return true
    }
    return false
  }, [targetEvent, isMutedByPubkey, isMutedByDomain, alwaysHideMutedNotes, hideContentMentioningMutedUsers, mutePubkeySet, filterMutedNotes, mutedDomains, isFetching])
  useEffect(() => {
    const fetch = async () => {
      try {
        const eventFromContent = event.content ? (JSON.parse(event.content) as Event) : null
        if (eventFromContent && verifyEvent(eventFromContent)) {
          if (eventFromContent.kind === kinds.Repost) {
            return
          }
          client.addEventToCache(eventFromContent)
          const targetSeenOn = client.getSeenEventRelays(eventFromContent.id)
          if (targetSeenOn.length === 0) {
            const seenOn = client.getSeenEventRelays(event.id)
            seenOn.forEach((relay) => {
              client.trackEventSeenOn(eventFromContent.id, relay)
            })
          }
          setTargetEvent(eventFromContent)
          return
        }

        const [, id, relay, , pubkey] = event.tags.find(tagNameEquals('e')) ?? []
        if (!id) {
          return
        }
        const targetEventId = nip19.neventEncode({
          id,
          relays: relay ? [relay] : [],
          author: pubkey
        })
        const targetEvent = await client.fetchEvent(targetEventId)
        if (targetEvent) {
          setTargetEvent(targetEvent)
        }
      } catch {
        // ignore
      }
    }
    fetch()
  }, [event])

  if (!targetEvent || shouldHide) return null

  // If alwaysHideMutedNotes is enabled and the note is muted by pubkey, show a message in the repost
  if (alwaysHideMutedNotes && isMutedByPubkey) {
    return (
      <div className={className}>
        <div className="py-3">
          <RepostDescription className="px-4" reposter={event.pubkey} />
          <div className="px-4 mt-2 text-muted-foreground font-medium">
            {t('You muted this note')}
          </div>
        </div>
        {!hideSeparator && <Separator />}
      </div>
    )
  }

  return (
    <MainNoteCard
      className={className}
      reposter={event.pubkey}
      event={targetEvent}
      pinned={pinned}
      hideSeparator={hideSeparator}
      onTagsChange={onTagsChange}
      bookmarkId={bookmarkId}
      filterMutedNotes={filterMutedNotes}
    />
  )
}
