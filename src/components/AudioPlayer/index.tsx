import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'
import mediaManager from '@/services/media-manager.service'
import { Minimize2, Pause, Play, Volume1, Volume2, VolumeX, X } from 'lucide-react'
import { MouseEvent, MutableRefObject, useEffect, useMemo, useRef, useState } from 'react'
import ExternalLink from '../ExternalLink'

interface AudioPlayerProps {
  src: string
  autoPlay?: boolean
  startTime?: number
  isMinimized?: boolean
  className?: string
}

export default function AudioPlayer({
  src,
  autoPlay = false,
  startTime,
  isMinimized = false,
  className
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState(false)
  const [waveformLevels, setWaveformLevels] = useState<number[]>([])
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null)
  const animationFrameRef = useRef<number>()
  const frequencyDataRef = useRef<Uint8Array | null>(null)
  const lastVolumeRef = useRef(1)

  const waveformSeed = useMemo(() => createWaveformSeed(src), [src])
  const playbackRatio = duration > 0 ? Math.min(currentTime / duration, 1) : 0

  useEffect(() => {
    setWaveformLevels(waveformSeed.map((seed) => clamp(seed, 22, 82)))
  }, [waveformSeed])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    if (startTime) {
      setCurrentTime(startTime)
      audio.currentTime = startTime
    }

    if (autoPlay) {
      void mediaManager.play(audio)
    }

    audio.volume = volume

    const updateTime = () => setCurrentTime(audio.currentTime)
    const updateDuration = () => setDuration(audio.duration)
    const handleEnded = () => setIsPlaying(false)
    const handlePause = () => setIsPlaying(false)
    const handlePlay = () => setIsPlaying(true)
    const handleVolumeStateChange = () => {
      setVolume(audio.volume)
      setIsMuted(audio.muted || audio.volume === 0)
      if (audio.volume > 0) {
        lastVolumeRef.current = audio.volume
      }
    }

    audio.addEventListener('timeupdate', updateTime)
    audio.addEventListener('loadedmetadata', updateDuration)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('play', handlePlay)
    audio.addEventListener('volumechange', handleVolumeStateChange)

    return () => {
      audio.removeEventListener('timeupdate', updateTime)
      audio.removeEventListener('loadedmetadata', updateDuration)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('volumechange', handleVolumeStateChange)
    }
  }, [autoPlay, startTime, volume])

  useEffect(() => {
    if (!isPlaying) {
      if (animationFrameRef.current) {
        window.cancelAnimationFrame(animationFrameRef.current)
      }
      setWaveformLevels(waveformSeed.map((seed) => clamp(seed, 22, 82)))
      return
    }

    let cancelled = false

    const animate = async () => {
      const analyser = await setupAudioVisualizer(
        audioRef.current,
        audioContextRef,
        sourceNodeRef,
        analyserRef,
        frequencyDataRef
      )

      let tick = 0

      const frame = () => {
        if (cancelled) {
          return
        }

        const liveLevels = getLiveWaveformLevels(analyser, frequencyDataRef.current, waveformSeed.length)

        if (liveLevels) {
          setWaveformLevels(liveLevels)
        } else {
          setWaveformLevels(
            waveformSeed.map((seed, index) => getFallbackWaveformBarHeight(seed, index, tick))
          )
        }

        tick += 1
        animationFrameRef.current = window.requestAnimationFrame(frame)
      }

      frame()
    }

    void animate()

    return () => {
      cancelled = true
      if (animationFrameRef.current) {
        window.cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [isPlaying, waveformSeed])

  useEffect(() => {
    const audio = audioRef.current
    const container = containerRef.current

    if (!audio || !container) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          mediaManager.pause(audio)
        }
      },
      { threshold: 1 }
    )

    observer.observe(container)

    return () => {
      observer.unobserve(container)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        window.cancelAnimationFrame(animationFrameRef.current)
      }
      sourceNodeRef.current?.disconnect()
      analyserRef.current?.disconnect()
      audioContextRef.current?.close().catch(() => undefined)
    }
  }, [])

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      mediaManager.pause(audio)
    } else {
      void mediaManager.play(audio)
    }
  }

  const handleVolumeChange = (value: number[]) => {
    const audio = audioRef.current
    if (!audio) return

    const nextVolume = Math.max(0, Math.min(1, value[0] / 100))
    audio.muted = nextVolume === 0
    audio.volume = nextVolume
    setVolume(nextVolume)
    setIsMuted(nextVolume === 0)

    if (nextVolume > 0) {
      lastVolumeRef.current = nextVolume
    }
  }

  const toggleMute = () => {
    const audio = audioRef.current
    if (!audio) return

    if (audio.muted || audio.volume === 0) {
      const restoredVolume = Math.max(lastVolumeRef.current, 0.35)
      audio.muted = false
      audio.volume = restoredVolume
      setVolume(restoredVolume)
      setIsMuted(false)
      return
    }

    lastVolumeRef.current = audio.volume
    audio.muted = true
    setIsMuted(true)
  }

  const volumeButtonIcon =
    isMuted || volume === 0 ? (
      <VolumeX className="size-4" />
    ) : volume < 0.5 ? (
      <Volume1 className="size-4" />
    ) : (
      <Volume2 className="size-4" />
    )

  const timeLabel =
    duration > 0
      ? `${formatTime(currentTime)} / ${formatTime(duration)}`
      : formatTime(currentTime)

  const renderedWaveformLevels = waveformSeed.map((seed, index) => {
    const rawHeight =
      waveformLevels[index] ?? clamp(seed, isPlaying ? 24 : 20, isPlaying ? 100 : 74)
    return clamp(rawHeight * 0.6, 10, 58)
  })

  const playedBars = Math.max(0, Math.ceil(playbackRatio * renderedWaveformLevels.length))

  const handleVolumePopoverClick = (event: MouseEvent) => {
    event.stopPropagation()
  }

  if (error) {
    return <ExternalLink url={src} />
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'flex w-full max-w-xl items-center gap-3 rounded-[28px] border border-white/10 bg-gradient-to-r from-card via-card to-card/80 px-3 py-2 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur-sm',
        className
      )}
      onClick={(event) => event.stopPropagation()}
    >
      <audio ref={audioRef} src={src} preload="metadata" onError={() => setError(true)} />

      <Button
        size="icon"
        className={cn(
          'h-11 w-11 shrink-0 rounded-full border border-primary/25 bg-primary text-primary-foreground shadow-[0_10px_24px_rgba(0,0,0,0.28)] hover:bg-primary/90',
          isPlaying && 'shadow-[0_0_0_6px_hsl(var(--primary)/0.14)]'
        )}
        onClick={togglePlay}
        aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
      >
        {isPlaying ? (
          <Pause className="size-4" fill="currentColor" />
        ) : (
          <Play className="size-4 translate-x-[1px]" fill="currentColor" />
        )}
      </Button>

      <div className="min-w-0 flex-1">
        <div className="rounded-[22px] border border-white/10 bg-black/35 px-3 py-2 shadow-inner shadow-black/30">
          <div className="grid h-6 grid-cols-[repeat(20,minmax(0,1fr))] items-center gap-0.5">
            {renderedWaveformLevels.map((height, index) => {
              const isPlayed = index < playedBars

              return (
                <div key={`${src}-${index}`} className="flex h-full items-center justify-center">
                  <span
                    className={cn(
                      'block w-[2px] rounded-full transition-[height,opacity,background-color,box-shadow] duration-150',
                      isPlayed
                        ? 'bg-primary shadow-[0_0_10px_hsl(var(--primary)/0.3)]'
                        : 'bg-white/18',
                      isPlaying ? 'opacity-100' : 'opacity-80'
                    )}
                    style={{ height: `${height}%` }}
                  />
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="shrink-0 font-mono text-sm font-medium tracking-tight text-foreground/85">
        {timeLabel}
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:bg-white/5 hover:text-foreground"
            onClick={(event) => event.stopPropagation()}
            aria-label="Adjust volume"
          >
            {volumeButtonIcon}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          sideOffset={10}
          className="w-44 rounded-2xl border-white/10 bg-popover/95 px-4 py-3 backdrop-blur"
          onClick={handleVolumePopoverClick}
        >
          <div className="mb-2 text-xs font-medium text-foreground/80">Volume</div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 rounded-full text-muted-foreground hover:bg-white/5 hover:text-foreground"
              onClick={toggleMute}
              aria-label={isMuted || volume === 0 ? 'Unmute audio' : 'Mute audio'}
            >
              {volumeButtonIcon}
            </Button>
            <Slider
              value={[Math.round((isMuted ? 0 : volume) * 100)]}
              max={100}
              step={1}
              onValueChange={handleVolumeChange}
            />
          </div>
        </PopoverContent>
      </Popover>

      {isMinimized ? (
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:bg-white/5 hover:text-foreground"
          onClick={() => mediaManager.stopAudioBackground()}
          aria-label="Close background audio"
        >
          <X className="size-4" />
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:bg-white/5 hover:text-foreground"
          onClick={() => mediaManager.playAudioBackground(src, audioRef.current?.currentTime || 0)}
          aria-label="Move audio to background player"
        >
          <Minimize2 className="size-4" />
        </Button>
      )}
    </div>
  )
}

function createWaveformSeed(src: string, bars = 20) {
  let hash = 0

  for (let index = 0; index < src.length; index++) {
    hash = (hash * 31 + src.charCodeAt(index)) >>> 0
  }

  return Array.from({ length: bars }, (_, index) => {
    const next = Math.sin(hash + index * 12.3456) * 10000
    const normalized = next - Math.floor(next)

    return 28 + normalized * 54
  })
}

function getWaveformBarHeight(base: number, index: number, tick: number, isPlaying: boolean) {
  if (!isPlaying) {
    return clamp(base, 22, 82)
  }

  const pulseA = (Math.sin(tick * 0.55 + index * 0.8) + 1) / 2
  const pulseB = (Math.cos(tick * 0.33 + index * 0.46) + 1) / 2
  const animated = base * 0.72 + pulseA * 18 + pulseB * 10

  return clamp(animated, 22, 100)
}

function getFallbackWaveformBarHeight(base: number, index: number, tick: number) {
  return getWaveformBarHeight(base, index, tick, true)
}

async function setupAudioVisualizer(
  audio: HTMLAudioElement | null,
  audioContextRef: MutableRefObject<AudioContext | null>,
  sourceNodeRef: MutableRefObject<MediaElementAudioSourceNode | null>,
  analyserRef: MutableRefObject<AnalyserNode | null>,
  frequencyDataRef: MutableRefObject<Uint8Array | null>
) {
  if (!audio || typeof window === 'undefined') {
    return null
  }

  const AudioContextCtor = window.AudioContext || (window as typeof window & {
    webkitAudioContext?: typeof AudioContext
  }).webkitAudioContext

  if (!AudioContextCtor) {
    return null
  }

  try {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextCtor()
    }

    const audioContext = audioContextRef.current

    if (audioContext.state === 'suspended') {
      await audioContext.resume()
    }

    if (!sourceNodeRef.current) {
      sourceNodeRef.current = audioContext.createMediaElementSource(audio)
    }

    if (!analyserRef.current) {
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.84
      sourceNodeRef.current.connect(analyser)
      analyser.connect(audioContext.destination)
      analyserRef.current = analyser
      frequencyDataRef.current = new Uint8Array(analyser.frequencyBinCount)
    }

    return analyserRef.current
  } catch (error) {
    console.debug('Audio visualizer unavailable:', error)
    return null
  }
}

function getLiveWaveformLevels(
  analyser: AnalyserNode | null,
  dataArray: Uint8Array | null,
  barCount: number
) {
  if (!analyser || !dataArray) {
    return null
  }

  analyser.getByteFrequencyData(dataArray)

  let maxValue = 0
  for (const value of dataArray) {
    if (value > maxValue) {
      maxValue = value
    }
  }

  if (maxValue < 6) {
    return null
  }

  const binsPerBar = Math.max(1, Math.floor(dataArray.length / barCount))
  const levels = Array.from({ length: barCount }, (_, index) => {
    const start = index * binsPerBar
    const end = index === barCount - 1 ? dataArray.length : start + binsPerBar

    let sum = 0
    for (let offset = start; offset < end; offset++) {
      sum += dataArray[offset]
    }

    const average = sum / Math.max(1, end - start)
    return clamp(18 + (average / 255) * 82, 22, 100)
  })

  return levels
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

const formatTime = (time: number) => {
  if (time === Infinity || Number.isNaN(time)) {
    return '-:--'
  }
  const minutes = Math.floor(time / 60)
  const seconds = Math.floor(time % 60)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}
