import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import PrimaryPageLayout from '@/layouts/PrimaryPageLayout'
import { RefreshButton } from '@/components/RefreshButton'
import PinButton from '@/components/PinButton'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { TPageRef } from '@/types'
import { isTouchDevice } from '@/lib/utils'
import { useMemo } from 'react'
import { useNostr } from '@/providers/NostrProvider'
import LiveEventList, { TLiveEventListRef } from '@/components/LiveEventList'

const LiveStreamsPage = forwardRef((_, ref) => {
  const { t } = useTranslation()
  const layoutRef = useRef<TPageRef>(null)
  const liveEventListRef = useRef<TLiveEventListRef>(null)
  const supportTouch = useMemo(() => isTouchDevice(), [])

  useImperativeHandle(ref, () => layoutRef.current)

  return (
    <PrimaryPageLayout
      pageName="livestreams"
      ref={layoutRef}
      titlebar={
        <LiveStreamsPageTitlebar
          liveEventListRef={liveEventListRef}
          supportTouch={supportTouch}
        />
      }
      displayScrollToTopButton
    >
      <LiveEventList ref={liveEventListRef} />
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
