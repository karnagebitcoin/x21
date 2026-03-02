import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import PrimaryPageLayout from '@/layouts/PrimaryPageLayout'
import { RefreshButton } from '@/components/RefreshButton'
import PinButton from '@/components/PinButton'
import { TPageRef } from '@/types'
import { isTouchDevice } from '@/lib/utils'
import { useMemo } from 'react'
import LiveEventList, { TLiveEventListRef } from '@/components/LiveEventList'
import LiveStreamView from '@/components/LiveStreamView'
import { Button } from '@/components/ui/button'
import { ChevronLeft } from 'lucide-react'
import { Event as NostrEvent } from 'nostr-tools'

const LiveStreamsPage = forwardRef((_, ref) => {
  const { t } = useTranslation()
  const layoutRef = useRef<TPageRef>(null)
  const liveEventListRef = useRef<TLiveEventListRef>(null)
  const supportTouch = useMemo(() => isTouchDevice(), [])
  const [activeStream, setActiveStream] = useState<{ naddr: string; title: string } | null>(null)

  useImperativeHandle(ref, () => layoutRef.current)

  const handleOpenStream = (naddr: string, event: NostrEvent) => {
    const title = event.tags.find((tag) => tag[0] === 'title')?.[1] || t('Live Stream')
    setActiveStream({ naddr, title })
  }

  const handleCloseStream = () => {
    setActiveStream(null)
  }

  return (
    <PrimaryPageLayout
      pageName="livestreams"
      ref={layoutRef}
      titlebar={
        activeStream ? (
          <ActiveStreamTitlebar title={activeStream.title} onBack={handleCloseStream} />
        ) : (
          <LiveStreamsPageTitlebar liveEventListRef={liveEventListRef} supportTouch={supportTouch} />
        )
      }
      displayScrollToTopButton
      hideBottomSpacer={!!activeStream}
    >
      {activeStream ? (
        <LiveStreamView naddr={activeStream.naddr} />
      ) : (
        <LiveEventList ref={liveEventListRef} onOpenStream={handleOpenStream} />
      )}
    </PrimaryPageLayout>
  )
})

LiveStreamsPage.displayName = 'LiveStreamsPage'
export default LiveStreamsPage

function LiveStreamsPageTitlebar({
  liveEventListRef,
  supportTouch
}: {
  liveEventListRef: React.RefObject<TLiveEventListRef>
  supportTouch: boolean
}) {
  const { t } = useTranslation()

  return (
    <div className="flex gap-1 items-center h-full justify-between">
      <div className="flex-1 pl-4">
        <div className="font-semibold text-lg">{t('Live Streams')}</div>
      </div>
      <div className="shrink-0 flex gap-1 items-center">
        <PinButton column={{ type: 'livestreams' }} size="titlebar-icon" />
        {!supportTouch && <RefreshButton onClick={() => liveEventListRef.current?.refresh()} />}
      </div>
    </div>
  )
}

function ActiveStreamTitlebar({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex gap-1 items-center h-full">
      <Button variant="ghost" size="titlebar-icon" onClick={onBack}>
        <ChevronLeft />
      </Button>
      <div className="font-semibold text-lg truncate pr-2">{title}</div>
    </div>
  )
}
