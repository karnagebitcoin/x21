import { ACTUAL_ZAP_SOUNDS, ExtendedKind, ZAP_SOUNDS } from '@/constants'
import { useListStatsById } from '@/hooks/useListStatsById'
import { getLightningAddressFromProfile } from '@/lib/lightning'
import { cn } from '@/lib/utils'
import { useNostr } from '@/providers/NostrProvider'
import { useZap } from '@/providers/ZapProvider'
import { usePaymentsEnabled } from '@/providers/PaymentsEnabledProvider'
import client from '@/services/client.service'
import lightning from '@/services/lightning.service'
import listStatsService from '@/services/list-stats.service'
import { Zap } from 'lucide-react'
import { MouseEvent, TouchEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import ZapDialog from '../ZapDialog'

export default function ListZapButton({
  authorPubkey,
  dTag,
  className,
  showAmount = true,
  variant = 'default'
}: {
  authorPubkey: string
  dTag: string
  className?: string
  showAmount?: boolean
  variant?: 'default' | 'compact'
}) {
  const { t } = useTranslation()
  const { checkLogin, pubkey } = useNostr()
  const { paymentsEnabled } = usePaymentsEnabled()
  const listStats = useListStatsById(authorPubkey, dTag)
  const { defaultZapSats, defaultZapComment, quickZap, zapSound, isWalletConnected } = useZap()
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null)
  const [openZapDialog, setOpenZapDialog] = useState(false)
  const [isPendingQuickZap, setIsPendingQuickZap] = useState(false)
  const { zapAmount, hasZapped } = useMemo(() => {
    return {
      zapAmount: listStats?.zaps?.reduce((acc, zap) => acc + zap.amount, 0),
      hasZapped: pubkey ? listStats?.zaps?.some((zap) => zap.pubkey === pubkey) : false
    }
  }, [listStats, pubkey])
  const [disable, setDisable] = useState(true)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isLongPressRef = useRef(false)

  useEffect(() => {
    client.fetchProfile(authorPubkey).then((profile) => {
      if (!profile) return
      if (pubkey === profile.pubkey) return
      const lightningAddress = getLightningAddressFromProfile(profile)
      if (lightningAddress) setDisable(false)
    })
  }, [authorPubkey, pubkey])

  const handleZap = async () => {
    try {
      if (!pubkey) {
        throw new Error('You need to be logged in to zap')
      }
      if (isPendingQuickZap) return

      // Play zap sound IMMEDIATELY when button is pressed (only if wallet is connected)
      if (isWalletConnected && zapSound !== ZAP_SOUNDS.NONE) {
        let soundToPlay = zapSound
        // If random is selected, pick a random sound
        if (zapSound === ZAP_SOUNDS.RANDOM) {
          const randomIndex = Math.floor(Math.random() * ACTUAL_ZAP_SOUNDS.length)
          soundToPlay = ACTUAL_ZAP_SOUNDS[randomIndex]
        }
        const audio = new Audio(`/sounds/${soundToPlay}.mp3`)
        audio.volume = 0.5
        audio.play().catch(() => {
          // Ignore errors (e.g., autoplay policy restrictions)
        })
      }

      setIsPendingQuickZap(true)

      // Create a virtual event representing the list for zapping
      const coordinate = `${ExtendedKind.STARTER_PACK}:${authorPubkey}:${dTag}`
      const zapResult = await lightning.zap(
        pubkey,
        coordinate,
        defaultZapSats,
        defaultZapComment
      )

      // user canceled
      if (!zapResult) {
        return
      }

      listStatsService.addZap(
        authorPubkey,
        dTag,
        pubkey,
        zapResult.invoice,
        defaultZapSats,
        defaultZapComment
      )
    } catch (error) {
      toast.error(`${t('Zap failed')}: ${(error as Error).message}`)
    } finally {
      setIsPendingQuickZap(false)
    }
  }

  const handleClickStart = (e: MouseEvent | TouchEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (disable) return

    isLongPressRef.current = false

    if ('touches' in e) {
      const touch = e.touches[0]
      setTouchStart({ x: touch.clientX, y: touch.clientY })
    }

    if (quickZap) {
      timerRef.current = setTimeout(() => {
        isLongPressRef.current = true
        checkLogin(() => {
          setOpenZapDialog(true)
        })
      }, 500)
    }
  }

  const handleClickEnd = (e: MouseEvent | TouchEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }
    if (disable) return

    if ('touches' in e) {
      setTouchStart(null)
      if (!touchStart) return
      const touch = e.changedTouches[0]
      const diffX = Math.abs(touch.clientX - touchStart.x)
      const diffY = Math.abs(touch.clientY - touchStart.y)
      if (diffX > 10 || diffY > 10) return
    }

    if (!quickZap) {
      checkLogin(() => {
        setOpenZapDialog(true)
      })
    } else if (!isLongPressRef.current) {
      checkLogin(() => handleZap())
    }
    isLongPressRef.current = false
  }

  const handleMouseLeave = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }
  }

  // Don't render if payments are not enabled
  if (!paymentsEnabled) {
    return null
  }

  if (variant === 'compact') {
    return (
      <>
        <button
          className={cn(
            'flex items-center gap-1 select-none',
            hasZapped || isPendingQuickZap ? 'text-yellow-400' : 'text-muted-foreground',
            disable
              ? 'cursor-not-allowed text-muted-foreground/40'
              : 'cursor-pointer enabled:hover:text-yellow-400',
            className
          )}
          title={t('Zap')}
          disabled={disable || isPendingQuickZap}
          onMouseDown={handleClickStart}
          onMouseUp={handleClickEnd}
          onMouseLeave={handleMouseLeave}
          onTouchStart={handleClickStart}
          onTouchEnd={handleClickEnd}
          aria-busy={isPendingQuickZap}
        >
          <Zap
            className={cn(
              'w-4 h-4',
              (hasZapped || isPendingQuickZap) && 'fill-yellow-400',
              isPendingQuickZap && 'animate-pulse'
            )}
          />
          {showAmount && !!zapAmount && (
            <div className="text-sm">{formatAmount(zapAmount)}</div>
          )}
        </button>
        <ZapDialog
          open={openZapDialog}
          setOpen={setOpenZapDialog}
          pubkey={authorPubkey}
        />
      </>
    )
  }

  return (
    <>
      <button
        className={cn(
          'flex items-center gap-1 select-none px-3 h-full',
          hasZapped || isPendingQuickZap ? 'text-yellow-400' : 'text-muted-foreground',
          disable
            ? 'cursor-not-allowed text-muted-foreground/40'
            : 'cursor-pointer enabled:hover:text-yellow-400',
          className
        )}
        title={t('Zap')}
        disabled={disable || isPendingQuickZap}
        onMouseDown={handleClickStart}
        onMouseUp={handleClickEnd}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleClickStart}
        onTouchEnd={handleClickEnd}
        aria-busy={isPendingQuickZap}
      >
        <Zap
          className={cn(
            (hasZapped || isPendingQuickZap) && 'fill-yellow-400',
            isPendingQuickZap && 'animate-pulse'
          )}
        />
        {showAmount && !!zapAmount && <div className="text-sm">{formatAmount(zapAmount)}</div>}
      </button>
      <ZapDialog
        open={openZapDialog}
        setOpen={setOpenZapDialog}
        pubkey={authorPubkey}
      />
    </>
  )
}

function formatAmount(amount: number) {
  if (amount < 1000) return amount
  if (amount < 1000000) return `${Math.round(amount / 100) / 10}k`
  return `${Math.round(amount / 100000) / 10}M`
}
