import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'
import mediaManager from '@/services/media-manager.service'
import { Minimize2, Pause, Play, X } from 'lucide-react'
import { MutableRefObject, useEffect, useMemo, useRef, useState } from 'react'
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
  const seekTimeoutRef = useRef<NodeJS.Timeout>()
  const isSeeking = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null)
  const animationFrameRef = useRef<number>()
  const frequencyDataRef = useRef<Uint8Array | null>(null)

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
  }, [autoPlay, startTime])

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
      if (seekTimeoutRef.current) {
        clearTimeout(seekTimeoutRef.current)
      }
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
    }, 160)
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
        <div className="relative overflow-hidden rounded-[22px] border border-white/6 bg-muted/40 px-3 py-2">
          <div
            className="pointer-events-none absolute inset-y-0 left-0 rounded-[22px] bg-primary/10 transition-[width] duration-300"
            style={{ width: `${playbackRatio * 100}%` }}
          />

          <div className="relative h-7">
            <div className="flex h-full items-end gap-[3px]">
              {waveformSeed.map((seed, index) => {
                const height =
                  waveformLevels[index] ?? clamp(seed, isPlaying ? 26 : 22, isPlaying ? 100 : 82)
                const isPlayed = (index + 1) / waveformSeed.length <= playbackRatio + 0.015

                return (
                  <span
                    key={`${src}-${index}`}
                    className={cn(
                      'block flex-1 rounded-full transition-[height,opacity,background-color] duration-200',
                      isPlayed ? 'bg-primary' : 'bg-foreground/18',
                      isPlaying ? 'opacity-100' : 'opacity-70'
                    )}
                    style={{ height: `${height}%` }}
                  />
                )
              })}
            </div>
          </div>

          <Slider
            className="absolute inset-0 z-10 opacity-0"
            value={[currentTime]}
            max={duration || 100}
            step={1}
            onValueChange={handleSeek}
            hideThumb
          />
        </div>
      </div>

      <div className="shrink-0 text-right">
        <div className="font-mono text-sm font-medium tracking-tight text-foreground/90">
          {formatTime(Math.max(duration - currentTime, 0))}
        </div>
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          remaining
        </div>
      </div>

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

function createWaveformSeed(src: string, bars = 28) {
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
