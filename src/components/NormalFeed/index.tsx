import NoteList, { TNoteListRef } from '@/components/NoteList'
import Tabs from '@/components/Tabs'
import { isTouchDevice } from '@/lib/utils'
import { useKindFilter } from '@/providers/KindFilterProvider'
import { useMediaOnly } from '@/providers/MediaOnlyProvider'
import { useUserTrust } from '@/providers/UserTrustProvider'
import storage from '@/services/local-storage.service'
import { TFeedSubRequest, TNoteListMode } from '@/types'
import { useMemo, useRef, useState } from 'react'
import KindFilter from '../KindFilter'
import { RefreshButton } from '../RefreshButton'

export default function NormalFeed({
  subRequests,
  areAlgoRelays = false,
  isMainFeed = false,
  showRelayCloseReason = false,
  isInDeckView = false
}: {
  subRequests: TFeedSubRequest[]
  areAlgoRelays?: boolean
  isMainFeed?: boolean
  showRelayCloseReason?: boolean
  isInDeckView?: boolean
}) {
  const { hideUntrustedNotes } = useUserTrust()
  const { showKinds } = useKindFilter()
  const { mediaOnly } = useMediaOnly()
  const [temporaryShowKinds, setTemporaryShowKinds] = useState(showKinds)
  const [temporaryMediaOnly, setTemporaryMediaOnly] = useState(mediaOnly)
  const [listMode, setListMode] = useState<TNoteListMode>(() => storage.getNoteListMode())
  const supportTouch = useMemo(() => isTouchDevice(), [])
  const noteListRef = useRef<TNoteListRef>(null)

  const handleListModeChange = (mode: TNoteListMode) => {
    setListMode(mode)
    if (isMainFeed) {
      storage.setNoteListMode(mode)
    }
    noteListRef.current?.scrollToTop('smooth')
  }

  const handleShowKindsChange = (newShowKinds: number[]) => {
    setTemporaryShowKinds(newShowKinds)
    noteListRef.current?.scrollToTop()
  }

  const handleMediaOnlyChange = (newMediaOnly: boolean) => {
    setTemporaryMediaOnly(newMediaOnly)
    noteListRef.current?.scrollToTop()
  }

  return (
    <>
      <Tabs
        value={listMode}
        tabs={[
          { value: 'posts', label: 'Notes' },
          { value: 'postsAndReplies', label: 'Replies' }
        ]}
        onTabChange={(listMode) => {
          handleListModeChange(listMode as TNoteListMode)
        }}
        options={
          <>
            {!supportTouch && <RefreshButton onClick={() => noteListRef.current?.refresh()} />}
            <KindFilter
              showKinds={temporaryShowKinds}
              onShowKindsChange={handleShowKindsChange}
              mediaOnly={temporaryMediaOnly}
              onMediaOnlyChange={handleMediaOnlyChange}
            />
          </>
        }
        isInDeckView={isInDeckView}
      />
      <NoteList
        ref={noteListRef}
        showKinds={temporaryShowKinds}
        mediaOnly={temporaryMediaOnly}
        subRequests={subRequests}
        isMainFeed={isMainFeed}
        hideReplies={listMode === 'posts'}
        hideUntrustedNotes={hideUntrustedNotes}
        areAlgoRelays={areAlgoRelays}
        showRelayCloseReason={showRelayCloseReason}
      />
    </>
  )
}
