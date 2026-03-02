import { cn } from '@/lib/utils'
import { useNostr } from '@/providers/NostrProvider'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { useZap } from '@/providers/ZapProvider'
import { usePaymentsEnabled } from '@/providers/PaymentsEnabledProvider'
import { useLowBandwidthMode } from '@/providers/LowBandwidthModeProvider'
import noteStatsService from '@/services/note-stats.service'
import { Event } from 'nostr-tools'
import { useEffect, useState } from 'react'
import BookmarkButton from '../BookmarkButton'
import BookmarkTagManager from '../BookmarkTagManager'
import ChargeZapButton from './ChargeZapButton'
import LikeButton from './LikeButton'
import Likes from './Likes'
import ReplyButton from './ReplyButton'
import RepostButton from './RepostButton'
import SeenOnButton from './SeenOnButton'
import TopZaps from './TopZaps'
import ZapButton from './ZapButton'

export default function NoteStats({
  event,
  className,
  classNames,
  fetchIfNotExisting = false,
  displayTopZapsAndLikes = false,
  onTagsChange,
  bookmarkId
}: {
  event: Event
  className?: string
  classNames?: {
    buttonBar?: string
  }
  fetchIfNotExisting?: boolean
  displayTopZapsAndLikes?: boolean
  onTagsChange?: () => void
  bookmarkId?: string
}) {
  const { isSmallScreen } = useScreenSize()
  const { pubkey } = useNostr()
  const { chargeZapEnabled, quickZap, onlyZapsMode, isWalletConnected } = useZap()
  const { paymentsEnabled } = usePaymentsEnabled()
  const { lowBandwidthMode } = useLowBandwidthMode()
  const [loading, setLoading] = useState(false)

  // Show charge zap button only if wallet is connected, payments are enabled, charge zap is enabled AND quick zap is enabled
  const showChargeZap = isWalletConnected && paymentsEnabled && chargeZapEnabled && quickZap

  useEffect(() => {
    if (!fetchIfNotExisting || lowBandwidthMode) return
    setLoading(true)
    noteStatsService.fetchNoteStats(event, pubkey).finally(() => setLoading(false))
  }, [event, fetchIfNotExisting, lowBandwidthMode, pubkey])

  if (isSmallScreen) {
    return (
      <div className={cn('select-none', className)}>
        {!lowBandwidthMode && displayTopZapsAndLikes && (
          <>
            <TopZaps event={event} />
            <Likes event={event} />
          </>
        )}
        <div
          className={cn(
            'flex justify-between items-center h-5 [&_svg]:size-5',
            classNames?.buttonBar
          )}
        >
          <div
            className={cn('flex items-center', loading ? 'animate-pulse' : '')}
            onClick={(e) => e.stopPropagation()}
          >
            <ReplyButton event={event} />
            <RepostButton event={event} />
            {!lowBandwidthMode && !onlyZapsMode && <LikeButton event={event} />}
            {!lowBandwidthMode && paymentsEnabled && <ZapButton event={event} />}
            {!lowBandwidthMode && showChargeZap && <ChargeZapButton event={event} />}
          </div>
          <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
            <SeenOnButton event={event} />
            <BookmarkButton event={event} />
            <BookmarkTagManager event={event} onTagsChange={onTagsChange} bookmarkId={bookmarkId} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('select-none', className)}>
      {!lowBandwidthMode && displayTopZapsAndLikes && (
        <>
          <TopZaps event={event} />
          <Likes event={event} />
        </>
      )}
      <div className="flex justify-between h-5 [&_svg]:size-4">
        <div
          className={cn('flex items-center', loading ? 'animate-pulse' : '')}
          onClick={(e) => e.stopPropagation()}
        >
          <ReplyButton event={event} />
          <RepostButton event={event} />
          {!lowBandwidthMode && !onlyZapsMode && <LikeButton event={event} />}
          {!lowBandwidthMode && paymentsEnabled && <ZapButton event={event} />}
          {!lowBandwidthMode && showChargeZap && <ChargeZapButton event={event} />}
        </div>
        <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
          <BookmarkButton event={event} />
          <BookmarkTagManager event={event} onTagsChange={onTagsChange} bookmarkId={bookmarkId} />
          <SeenOnButton event={event} />
        </div>
      </div>
    </div>
  )
}
