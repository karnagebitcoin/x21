import MuteButton from '@/components/MuteButton'
import Nip05 from '@/components/Nip05'
import SearchInput from '@/components/SearchInput'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import UserAvatar from '@/components/UserAvatar'
import Username from '@/components/Username'
import { useFetchProfile } from '@/hooks'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { useMuteList } from '@/providers/MuteListProvider'
import { useNostr } from '@/providers/NostrProvider'
import { StickyNote } from 'lucide-react'
import { forwardRef, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import NotFoundPage from '../NotFoundPage'

const MuteListPage = forwardRef(({ index }: { index?: number }, ref) => {
  const { t } = useTranslation()
  const { profile, pubkey } = useNostr()
  const { getMutePubkeys } = useMuteList()
  const mutePubkeys = useMemo(() => getMutePubkeys(), [pubkey])
  const [visibleMutePubkeys, setVisibleMutePubkeys] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setVisibleMutePubkeys(mutePubkeys.slice(0, 10))
  }, [mutePubkeys])

  useEffect(() => {
    const options = {
      root: null,
      rootMargin: '10px',
      threshold: 1
    }

    const observerInstance = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && mutePubkeys.length > visibleMutePubkeys.length) {
        setVisibleMutePubkeys((prev) => [
          ...prev,
          ...mutePubkeys.slice(prev.length, prev.length + 10)
        ])
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
  }, [visibleMutePubkeys, mutePubkeys])

  if (!profile) {
    return <NotFoundPage />
  }

  return (
    <SecondaryPageLayout
      ref={ref}
      index={index}
      title={t("username's muted", { username: profile.username })}
      displayScrollToTopButton
    >
      <div className="px-4 pt-2 pb-3 sticky top-0 bg-background z-10">
        <SearchInput
          placeholder="Search muted users..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>
      <div className="px-4">
        <div className="mb-4 p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
          {t('Mutes created in x21 are private and encrypted. Public mutes from other clients are also respected.')}
        </div>
        <div className="space-y-2">
          {visibleMutePubkeys.map((pubkey, index) => (
            <FilteredUserItem key={`${index}-${pubkey}`} pubkey={pubkey} searchQuery={searchQuery} />
          ))}
          {mutePubkeys.length > visibleMutePubkeys.length && <div ref={bottomRef} />}
        </div>
      </div>
    </SecondaryPageLayout>
  )
})
MuteListPage.displayName = 'MuteListPage'
export default MuteListPage

// Wrapper component that handles filtering logic
function FilteredUserItem({ pubkey, searchQuery }: { pubkey: string; searchQuery?: string }) {
  const { profile } = useFetchProfile(pubkey)
  const { getMuteNote } = useMuteList()
  const existingNote = getMuteNote(pubkey)

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
    const note = existingNote?.toLowerCase() || ''

    return (
      username.includes(query) ||
      originalUsername.includes(query) ||
      nip05.includes(query) ||
      about.includes(query) ||
      note.includes(query) ||
      pubkey.toLowerCase().includes(query)
    )
  }, [profile, searchQuery, pubkey, existingNote])

  if (!shouldShow) {
    return null
  }

  return <UserItem pubkey={pubkey} />
}

function UserItem({ pubkey }: { pubkey: string }) {
  const { t } = useTranslation()
  const { getMuteNote, setMuteNote } = useMuteList()
  const { profile } = useFetchProfile(pubkey)
  const [showNoteInput, setShowNoteInput] = useState(false)
  const [noteText, setNoteText] = useState('')
  const existingNote = getMuteNote(pubkey)

  useEffect(() => {
    setNoteText(existingNote || '')
  }, [existingNote])

  const handleSaveNote = () => {
    setMuteNote(pubkey, noteText.trim())
    setShowNoteInput(false)
  }

  return (
    <div className="flex flex-col gap-2 p-2 border rounded-lg">
      <div className="flex gap-2 items-start">
        <UserAvatar userId={pubkey} className="shrink-0" />
        <div className="w-full overflow-hidden">
          <div className="flex items-center gap-2">
            <Username
              userId={pubkey}
              className="font-semibold truncate max-w-full w-fit"
              skeletonClassName="h-4"
            />
          </div>
          <Nip05 pubkey={pubkey} />
          <div className="truncate text-muted-foreground text-sm">{profile?.about}</div>
        </div>
        <div className="flex gap-2 items-center shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowNoteInput(!showNoteInput)}
            title={t('Add note')}
          >
            <StickyNote className={existingNote ? 'text-yellow-600' : ''} />
          </Button>
          <MuteButton pubkey={pubkey} />
        </div>
      </div>
      {showNoteInput && (
        <div className="space-y-2 pl-12">
          <Textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder={t('Add a note about why you muted this user...')}
            className="text-xs min-h-[60px] resize-none"
          />
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setNoteText(existingNote || '')
                setShowNoteInput(false)
              }}
            >
              {t('Cancel')}
            </Button>
            <Button size="sm" onClick={handleSaveNote}>
              {t('Save')}
            </Button>
          </div>
        </div>
      )}
      {existingNote && !showNoteInput && (
        <div className="pl-12 text-xs text-muted-foreground italic">
          {existingNote}
        </div>
      )}
    </div>
  )
}
