import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useNostr } from '@/providers/NostrProvider'
import { useZap } from '@/providers/ZapProvider'
import { usePaymentsEnabled } from '@/providers/PaymentsEnabledProvider'
import mediaManager from '@/services/media-manager.service'
import lightning from '@/services/lightning.service'
import noteStatsService from '@/services/note-stats.service'
import { Event } from 'nostr-tools'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Minimize2, Music2, Pause, Play, Zap } from 'lucide-react'
import { ACTUAL_ZAP_SOUNDS, ZAP_SOUNDS } from '@/constants'
import ExternalLink from '../ExternalLink'
import Image from '../Image'

interface MusicTrackProps {
  event: Event
  className?: string
}

export default function MusicTrack({ event, className }: MusicTrackProps) {
  const { t } = useTranslation()
  const { pubkey } = useNostr()
  const { defaultZapSats, defaultZapComment, zapSound, isWalletConnected } = useZap()
  const { paymentsEnabled } = usePaymentsEnabled()
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState(false)
  const [zapping, setZapping] = useState(false)
  const seekTimeoutRef = useRef<NodeJS.Timeout>()
  const isSeeking = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Extract metadata from tags
  const getTag = (name: string) => event.tags.find((tag) => tag[0] === name)?.[1]
  const getAllTags = (name: string) => event.tags.filter((tag) => tag[0] === name)

  const title = getTag('title') || 'Untitled Track'
  const url = getTag('url')
  const image = getTag('image')
  const artist = getTag('artist')
  const album = getTag('album')
  const trackNumber = getTag('track_number')
  const released = getTag('released')
  const durationTag = getTag('duration')
  const format = getTag('format')
  const zapTags = getAllTags('zap') // Get all zap split tags

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const updateTime = () => {
      if (!isSeeking.current) {
        setCurrentTime(audio.currentTime)
      }
    }
    const updateDuration = () => setDuration(audio.duration)
    const handleEnded = () => setIsPlaying(false)
    const handlePause = () => setIsPlaying(false)
    const handlePlay = () => setIsPlaying(true)

    audio.addEventListener('timeupdate', updateTime)
    audio.addEventListener('loadedmetadata', updateDuration)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('play', handlePlay)

    return () => {
      audio.removeEventListener('timeupdate', updateTime)
      audio.removeEventListener('loadedmetadata', updateDuration)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('play', handlePlay)
    }
  }, [])

  useEffect(() => {
    const audio = audioRef.current
    const container = containerRef.current

    if (!audio || !container) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          audio.pause()
        }
      },
      { threshold: 0.5 }
    )

    observer.observe(container)

    return () => {
      observer.unobserve(container)
    }
  }, [])

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.pause()
      setIsPlaying(false)
    } else {
      audio.play()
      setIsPlaying(true)
      mediaManager.play(audio)
    }
  }

  const handleSeek = (value: number[]) => {
    const audio = audioRef.current
    if (!audio) return

    isSeeking.current = true
    setCurrentTime(value[0])

    if (seekTimeoutRef.current) {
      clearTimeout(seekTimeoutRef.current)
    }

    seekTimeoutRef.current = setTimeout(() => {
      audio.currentTime = value[0]
      isSeeking.current = false
    }, 300)
  }

  const handleZap = async () => {
    try {
      if (!pubkey) {
        throw new Error(t('You need to be logged in to zap'))
      }
      if (zapping) return

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

      setZapping(true)
      const zapResult = await lightning.zap(pubkey, event, defaultZapSats, defaultZapComment)
      // user canceled
      if (!zapResult) {
        return
      }
      noteStatsService.addZap(
        pubkey,
        event.id,
        zapResult.invoice,
        defaultZapSats,
        defaultZapComment
      )
      toast.success(t('Zap sent successfully'))
    } catch (error) {
      toast.error(`${t('Zap failed')}: ${(error as Error).message}`)
    } finally {
      setZapping(false)
    }
  }

  if (!url) {
    return (
      <div className={cn('text-muted-foreground', className)}>
        {t('Invalid music track: missing audio URL')}
      </div>
    )
  }

  if (error) {
    return <ExternalLink url={url} />
  }

  return (
    <div ref={containerRef} className={className}>
      <audio ref={audioRef} src={url} preload="metadata" onError={() => setError(true)} />

      <div className="flex gap-4">
        {/* Album Art */}
        <div className="shrink-0">
          {image && image.trim() ? (
            <Image
              image={{ url: image, pubkey: event.pubkey }}
              alt={title}
              className="w-24 h-24 object-cover"
              style={{ borderRadius: 'var(--media-radius, 12px)' }}
            />
          ) : (
            <div className="w-24 h-24 bg-muted flex items-center justify-center" style={{ borderRadius: 'var(--media-radius, 12px)' }}>
              <Music2 className="w-12 h-12 text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Track Info */}
        <div className="flex-1 flex flex-col justify-between min-w-0">
          <div>
            <h3 className="font-semibold truncate">{title}</h3>
            {artist && (
              <p className="text-sm text-muted-foreground truncate">{artist}</p>
            )}
            {album && (
              <p className="text-xs text-muted-foreground truncate">
                {album}
                {trackNumber && ` • Track ${trackNumber}`}
                {released && ` • ${released.split('-')[0]}`}
              </p>
            )}
            {format && (
              <p className="text-xs text-muted-foreground uppercase mt-1">
                {format}
                {durationTag && ` • ${formatTime(parseInt(durationTag))}`}
              </p>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 mt-2">
            {/* Play/Pause Button */}
            <Button
              size="icon"
              variant="outline"
              className="rounded-full shrink-0 h-10 w-10"
              onClick={(e) => {
                e.stopPropagation()
                togglePlay()
              }}
            >
              {isPlaying ? (
                <Pause className="h-4 w-4" fill="currentColor" />
              ) : (
                <Play className="h-4 w-4" fill="currentColor" />
              )}
            </Button>

            {/* Progress Bar */}
            <div className="flex-1" onClick={(e) => e.stopPropagation()}>
              <Slider
                value={[currentTime]}
                max={duration || 100}
                step={1}
                onValueChange={handleSeek}
                hideThumb
                enableHoverAnimation
              />
            </div>

            {/* Time Display */}
            <div className="text-xs font-mono text-muted-foreground shrink-0 whitespace-nowrap">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>

            {/* Zap Button */}
            {paymentsEnabled && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="outline"
                      className="rounded-full shrink-0 h-10 w-10 hover:bg-orange-500/10 hover:text-orange-500 hover:border-orange-500/50"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleZap()
                      }}
                      disabled={zapping || !pubkey}
                    >
                      <Zap
                        className={cn('h-4 w-4', zapping && 'animate-pulse')}
                        fill={zapping ? 'currentColor' : 'none'}
                      />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      {zapTags.length > 0
                        ? t('Zap this track (splits enabled)')
                        : t('Zap this track')}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {/* Minimize Button */}
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full shrink-0 h-10 w-10 text-muted-foreground"
              onClick={(e) => {
                e.stopPropagation()
                mediaManager.playAudioBackground(url, audioRef.current?.currentTime || 0)
              }}
            >
              <Minimize2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

const formatTime = (time: number) => {
  if (time === Infinity || isNaN(time)) {
    return '0:00'
  }
  const minutes = Math.floor(time / 60)
  const seconds = Math.floor(time % 60)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}
