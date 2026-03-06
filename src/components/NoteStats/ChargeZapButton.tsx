import { ACTUAL_ZAP_SOUNDS, ZAP_SOUNDS } from '@/constants'
import { useNoteStatsById } from '@/hooks/useNoteStatsById'
import { getLightningAddressFromProfile } from '@/lib/lightning'
import { cn } from '@/lib/utils'
import { useNostr } from '@/providers/NostrProvider'
import { useZap } from '@/providers/ZapProvider'
import client from '@/services/client.service'
import lightning from '@/services/lightning.service'
import noteStatsService from '@/services/note-stats.service'
import confetti from 'canvas-confetti'
import { Loader, PlugZap } from 'lucide-react'
import { Event } from 'nostr-tools'
import { MouseEvent, TouchEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

// Charging algorithm: starts slow, then accelerates
const calculateChargeAmount = (holdDuration: number, limit: number): number => {
  // Duration in milliseconds
  // Algorithm:
  // - First 500ms: 1 sat per 100ms (5 sats total)
  // - Next 1000ms: 2 sats per 100ms (20 sats total = 25 cumulative)
  // - Next 1500ms: 5 sats per 100ms (75 sats total = 100 cumulative)
  // - After 3000ms: 10 sats per 100ms (accelerating)

  let amount = 0

  if (holdDuration <= 500) {
    amount = Math.floor(holdDuration / 100)
  } else if (holdDuration <= 1500) {
    amount = 5 + Math.floor((holdDuration - 500) / 50)
  } else if (holdDuration <= 3000) {
    amount = 25 + Math.floor((holdDuration - 1500) / 20)
  } else {
    amount = 100 + Math.floor((holdDuration - 3000) / 10)
  }

  return Math.min(amount, limit)
}

const fireConfetti = (element: HTMLElement, amount: number, limit: number) => {
  const rect = element.getBoundingClientRect()
  const x = (rect.left + rect.width / 2) / window.innerWidth
  const y = (rect.top + rect.height / 2) / window.innerHeight

  // Calculate intensity based on amount vs limit
  const intensity = amount / limit
  const particleCount = Math.floor(30 + intensity * 120) // 30-150 particles
  const spread = 60 + intensity * 60 // 60-120 degrees

  confetti({
    particleCount,
    spread,
    origin: { x, y },
    colors: ['#FFD700', '#FFA500', '#FF8C00', '#FFFF00', '#FFE55C'],
    ticks: 200,
    gravity: 1.2,
    decay: 0.94,
    startVelocity: 20 + intensity * 30,
    scalar: 0.8 + intensity * 0.7
  })
}

export default function ChargeZapButton({ event }: { event: Event }) {
  const { t } = useTranslation()
  const { checkLogin, pubkey } = useNostr()
  const noteStats = useNoteStatsById(event.id)
  const { chargeZapLimit, zapSound, isWalletConnected } = useZap()
  const [isCharging, setIsCharging] = useState(false)
  const [chargeAmount, setChargeAmount] = useState(0)
  const [zapping, setZapping] = useState(false)
  const [disable, setDisable] = useState(true)
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null)

  const buttonRef = useRef<HTMLButtonElement>(null)
  const chargeStartTimeRef = useRef<number>(0)
  const chargeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isTouchDeviceRef = useRef(false)

  const { hasZapped } = useMemo(() => {
    return {
      hasZapped: pubkey ? noteStats?.zaps?.some((zap) => zap.pubkey === pubkey) : false
    }
  }, [noteStats, pubkey])

  useEffect(() => {
    client.fetchProfile(event.pubkey).then((profile) => {
      if (!profile) return
      if (pubkey === profile.pubkey) return
      const lightningAddress = getLightningAddressFromProfile(profile)
      if (lightningAddress) setDisable(false)
    })
  }, [event, pubkey])

  const startCharging = () => {
    setIsCharging(true)
    setChargeAmount(0)
    chargeStartTimeRef.current = Date.now()

    // Update charge amount frequently for smooth animation
    chargeIntervalRef.current = setInterval(() => {
      const duration = Date.now() - chargeStartTimeRef.current
      const amount = calculateChargeAmount(duration, chargeZapLimit)
      setChargeAmount(amount)

      // Stop at limit
      if (amount >= chargeZapLimit && chargeIntervalRef.current) {
        clearInterval(chargeIntervalRef.current)
      }
    }, 50) // Update every 50ms for smooth counter
  }

  const stopCharging = async () => {
    if (chargeIntervalRef.current) {
      clearInterval(chargeIntervalRef.current)
      chargeIntervalRef.current = null
    }

    const finalAmount = chargeAmount
    setIsCharging(false)
    setChargeAmount(0)

    if (finalAmount === 0 || !buttonRef.current) return

    // Fire confetti
    fireConfetti(buttonRef.current, finalAmount, chargeZapLimit)

    // Send the zap
    try {
      if (!pubkey) {
        throw new Error('You need to be logged in to zap')
      }

      // Play zap sound (only if wallet is connected)
      if (isWalletConnected && zapSound !== ZAP_SOUNDS.NONE) {
        let soundToPlay = zapSound
        if (zapSound === ZAP_SOUNDS.RANDOM) {
          const randomIndex = Math.floor(Math.random() * ACTUAL_ZAP_SOUNDS.length)
          soundToPlay = ACTUAL_ZAP_SOUNDS[randomIndex]
        }
        const audio = new Audio(`/sounds/${soundToPlay}.mp3`)
        audio.volume = 0.5
        audio.play().catch(() => {
          // Ignore errors
        })
      }

      setZapping(true)
      const zapResult = await lightning.zap(pubkey, event, finalAmount, '')

      if (!zapResult) {
        return
      }

      noteStatsService.addZap(pubkey, event.id, zapResult.invoice, finalAmount, '')
      toast.success(t('Zap sent successfully', { defaultValue: 'Zap sent successfully' }))
    } catch (error) {
      toast.error(`${t('Zap failed')}: ${(error as Error).message}`)
    } finally {
      setZapping(false)
    }
  }

  const handleMouseDown = (e: MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (disable || zapping) return

    isTouchDeviceRef.current = false
    checkLogin(() => startCharging())
  }

  const handleMouseUp = (e: MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (disable || zapping || isTouchDeviceRef.current) return

    stopCharging()
  }

  const handleMouseLeave = () => {
    if (isCharging && !isTouchDeviceRef.current) {
      if (chargeIntervalRef.current) {
        clearInterval(chargeIntervalRef.current)
        chargeIntervalRef.current = null
      }
      setIsCharging(false)
      setChargeAmount(0)
    }
  }

  const handleTouchStart = (e: TouchEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (disable || zapping) return

    isTouchDeviceRef.current = true
    const touch = e.touches[0]
    setTouchStart({ x: touch.clientX, y: touch.clientY })

    checkLogin(() => startCharging())
  }

  const handleTouchEnd = (e: TouchEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (disable || zapping || !touchStart) return

    const touch = e.changedTouches[0]
    const diffX = Math.abs(touch.clientX - touchStart.x)
    const diffY = Math.abs(touch.clientY - touchStart.y)

    setTouchStart(null)

    // If significant movement, cancel the charge
    if (diffX > 10 || diffY > 10) {
      if (chargeIntervalRef.current) {
        clearInterval(chargeIntervalRef.current)
        chargeIntervalRef.current = null
      }
      setIsCharging(false)
      setChargeAmount(0)
      return
    }

    stopCharging()
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (chargeIntervalRef.current) {
        clearInterval(chargeIntervalRef.current)
      }
    }
  }, [])

  return (
    <div className="relative">
      {isCharging && (
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-yellow-400 text-black px-2 py-1 rounded-md font-bold text-sm whitespace-nowrap z-10 animate-pulse">
          {chargeAmount} {t('Sats')}
        </div>
      )}
      <button
        ref={buttonRef}
        className={cn(
          'flex items-center gap-1 select-none px-3 h-full relative',
          hasZapped || isCharging ? 'text-yellow-400' : 'text-muted-foreground',
          disable
            ? 'cursor-not-allowed text-muted-foreground/40'
            : 'cursor-pointer enabled:hover:text-yellow-400'
        )}
        title={t('Charge Zap')}
        disabled={disable || zapping}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {zapping ? (
          <Loader className="animate-spin" />
        ) : (
          <PlugZap
            className={cn(
              hasZapped || isCharging ? 'fill-yellow-400' : '',
              isCharging ? 'animate-pulse scale-110' : ''
            )}
          />
        )}
        {isCharging && (
          <div className="absolute inset-0 rounded-full border-2 border-yellow-400 animate-ping opacity-75" />
        )}
      </button>
    </div>
  )
}
