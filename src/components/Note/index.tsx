import { useSecondaryPage } from '@/PageManager'
import { ExtendedKind, SUPPORTED_KINDS } from '@/constants'
import { getNoteBech32Id, getParentBech32Id, isFromMutedDomain, isNsfwEvent } from '@/lib/event'
import { toNote } from '@/lib/link'
import { cn } from '@/lib/utils'
import { useFetchProfile } from '@/hooks'
import { useContentPolicy } from '@/providers/ContentPolicyProvider'
import { useMuteList } from '@/providers/MuteListProvider'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { Event, kinds } from 'nostr-tools'
import { useMemo, useState } from 'react'
import AudioPlayer from '../AudioPlayer'
import ClientTag from '../ClientTag'
import Content from '../Content'
import { FormattedTimestamp } from '../FormattedTimestamp'
import Nip05 from '../Nip05'
import NoteOptions from '../NoteOptions'
import ParentNotePreview from '../ParentNotePreview'
import TranslateButton from '../TranslateButton'
import UserAvatar from '../UserAvatar'
import Username from '../Username'
import { EmbeddedLiveStream } from '../Embedded'
import LiveStreamPresenceBadge from '../LiveStreamPresenceBadge'
import CommunityDefinition from './CommunityDefinition'
import GroupMetadata from './GroupMetadata'
import Highlight from './Highlight'
import IValue from './IValue'
import LiveEvent from './LiveEvent'
import LongFormArticle from './LongFormArticle'
import LongFormArticlePreview from './LongFormArticlePreview'
import MutedNote from './MutedNote'
import NsfwNote from './NsfwNote'
import PictureNote from './PictureNote'
import Poll from './Poll'
import UnknownNote from './UnknownNote'
import VideoNote from './VideoNote'
import RelayReview from './RelayReview'
import MusicTrack from './MusicTrack'

export default function Note({
  event,
  originalNoteId,
  size = 'normal',
  className,
  hideParentNotePreview = false,
  showFull = false,
  compactMedia = false,
  metadataClassName,
  filterMutedNotes = true
}: {
  event: Event
  originalNoteId?: string
  size?: 'normal' | 'small'
  className?: string
  hideParentNotePreview?: boolean
  showFull?: boolean
  compactMedia?: boolean
  metadataClassName?: string
  filterMutedNotes?: boolean
}) {
  const { push } = useSecondaryPage()
  const { isSmallScreen } = useScreenSize()
  const parentEventId = useMemo(
    () => (hideParentNotePreview ? undefined : getParentBech32Id(event)),
    [event, hideParentNotePreview]
  )
  const { defaultShowNsfw, alwaysHideMutedNotes } = useContentPolicy()
  const [showNsfw, setShowNsfw] = useState(false)
  const { mutePubkeySet, getMutedDomains } = useMuteList()
  const [showMuted, setShowMuted] = useState(false)
  const { profile, isFetching } = useFetchProfile(event.pubkey)
  const mutedDomains = getMutedDomains()

  const isMutedByPubkey = mutePubkeySet.has(event.pubkey)
  const isMutedByDomain = useMemo(() => {
    return profile && isFromMutedDomain(profile.nip05, mutedDomains)
  }, [profile, mutedDomains])

  // If alwaysHideMutedNotes is enabled AND we're filtering mutes, completely hide pubkey-muted notes
  if (filterMutedNotes && alwaysHideMutedNotes && isMutedByPubkey) {
    return null
  }

  // Always completely hide domain-muted notes when filtering is enabled
  if (filterMutedNotes && isMutedByDomain) {
    return null
  }

  // If we have muted domains configured and profile is still loading, wait for profile to load
  if (filterMutedNotes && mutedDomains.length > 0 && isFetching) {
    return null
  }

  let content: React.ReactNode
  if (
    ![
      ...SUPPORTED_KINDS,
      kinds.CommunityDefinition,
      kinds.LiveEvent,
      ExtendedKind.GROUP_METADATA
    ].includes(event.kind)
  ) {
    content = <UnknownNote className="mt-2" event={event} />
  } else if (filterMutedNotes && isMutedByPubkey && !showMuted) {
    content = <MutedNote show={() => setShowMuted(true)} />
  } else if (!defaultShowNsfw && isNsfwEvent(event) && !showNsfw) {
    content = <NsfwNote show={() => setShowNsfw(true)} />
  } else if (event.kind === kinds.Highlights) {
    content = <Highlight className="mt-2" event={event} />
  } else if (event.kind === kinds.LongFormArticle) {
    content = showFull ? (
      <LongFormArticle className="mt-2" event={event} />
    ) : (
      <LongFormArticlePreview className="mt-2" event={event} />
    )
  } else if (event.kind === kinds.LiveEvent) {
    content =
      size === 'small' ? (
        <EmbeddedLiveStream
          className="mt-2"
          event={event}
          noteId={originalNoteId ?? getNoteBech32Id(event)}
        />
      ) : (
        <LiveEvent className="mt-2" event={event} />
      )
  } else if (event.kind === ExtendedKind.GROUP_METADATA) {
    content = <GroupMetadata className="mt-2" event={event} originalNoteId={originalNoteId} />
  } else if (event.kind === kinds.CommunityDefinition) {
    content = <CommunityDefinition className="mt-2" event={event} />
  } else if (event.kind === ExtendedKind.POLL) {
    content = (
      <>
        <Content className="mt-2" event={event} compactMedia={compactMedia} />
        <Poll className="mt-2" event={event} />
      </>
    )
  } else if (event.kind === ExtendedKind.VOICE || event.kind === ExtendedKind.VOICE_COMMENT) {
    content = <AudioPlayer className="mt-2" src={event.content} />
  } else if (event.kind === ExtendedKind.PICTURE) {
    content = <PictureNote className="mt-2" event={event} compactMedia={compactMedia} />
  } else if (event.kind === ExtendedKind.VIDEO || event.kind === ExtendedKind.SHORT_VIDEO) {
    content = <VideoNote className="mt-2" event={event} compactMedia={compactMedia} />
  } else if (event.kind === ExtendedKind.RELAY_REVIEW) {
    content = <RelayReview className="mt-2" event={event} />
  } else if (event.kind === ExtendedKind.MUSIC_TRACK) {
    content = <MusicTrack className="mt-2" event={event} />
  } else {
    content = <Content className="mt-2" event={event} compactMedia={compactMedia} />
  }

  // For music tracks when embedded (quoted), render only the player without header/metadata
  if (event.kind === ExtendedKind.MUSIC_TRACK && size === 'small') {
    return (
      <div className={className}>
        {content}
      </div>
    )
  }

  return (
    <div className={className}>
      <header className="flex justify-between items-start gap-2">
        <div className="flex items-center space-x-2 flex-1">
          <div className="flex items-center gap-2 shrink-0">
            <UserAvatar userId={event.pubkey} size={size === 'small' ? 'medium' : 'normal'} />
            <LiveStreamPresenceBadge pubkey={event.pubkey} />
          </div>
          <div className="flex-1 w-0">
            <div className="flex gap-2 items-center">
              <Username
                userId={event.pubkey}
                className={`font-semibold flex truncate ${size === 'small' ? 'text-sm' : ''}`}
                skeletonClassName={size === 'small' ? 'h-3' : 'h-4'}
                asHeading={true}
                headingLevel={size === 'small' ? 4 : 3}
              />
              <ClientTag event={event} />
            </div>
            <div className={cn("flex items-center gap-1 text-sm", metadataClassName || "text-muted-foreground")}>
              <Nip05 pubkey={event.pubkey} append="·" />
              <FormattedTimestamp
                timestamp={event.created_at}
                className="shrink-0"
                short={isSmallScreen}
              />
            </div>
          </div>
        </div>
        <div className="flex items-center">
          <TranslateButton event={event} className={size === 'normal' ? '' : 'pr-0'} />
          {size === 'normal' && (
            <NoteOptions event={event} className="py-1 shrink-0 [&_svg]:size-5" />
          )}
        </div>
      </header>
      {parentEventId && (
        <ParentNotePreview
          eventId={parentEventId}
          className="mt-2"
          onClick={(e) => {
            e.stopPropagation()
            push(toNote(parentEventId))
          }}
        />
      )}
      <IValue event={event} className="mt-2" />
      {content}
    </div>
  )
}
