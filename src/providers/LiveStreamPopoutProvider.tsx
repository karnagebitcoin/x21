import {
  PointerEvent as ReactPointerEvent,
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { createPortal } from 'react-dom'
import { Pause, PictureInPicture2, Play, Volume2, VolumeX, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import liveStreamSyncService, { TLiveStreamSyncCommand } from '@/services/live-stream-sync.service'

type LiveStreamPopoutPayload = {
  streamingUrl: string
  title: string
  image?: string
  naddr?: string
}

type LiveStreamPopoutContextValue = {
  popout: LiveStreamPopoutPayload | null
  isOpen: boolean
  openPopout: (payload: LiveStreamPopoutPayload) => void
  closePopout: () => void
  isPopoutOpenForUrl: (streamingUrl?: string) => boolean
}

type PopoutLayout = {
  x: number
  y: number
  width: number
  height: number
}

const STORAGE_KEY = 'live-stream-popout-layout-v1'
const DEFAULT_WIDTH = 420
const DEFAULT_HEIGHT = 236
const MIN_WIDTH = 300
const MIN_HEIGHT = 170
const EDGE_PADDING = 8
const CONTROL_HIDE_DELAY = 2200

const LiveStreamPopoutContext = createContext<LiveStreamPopoutContextValue | undefined>(undefined)

function getViewportBounds() {
  const maxWidth = Math.max(320, window.innerWidth - EDGE_PADDING * 2)
  const maxHeight = Math.max(180, window.innerHeight - EDGE_PADDING * 2)
  return { maxWidth, maxHeight }
}

function createDefaultLayout(): PopoutLayout {
  const { maxWidth, maxHeight } = getViewportBounds()
  const width = Math.min(DEFAULT_WIDTH, maxWidth)
  const height = Math.min(DEFAULT_HEIGHT, maxHeight)
  const x = Math.max(EDGE_PADDING, window.innerWidth - width - 16)
  const y = Math.max(EDGE_PADDING, window.innerHeight - height - 16)
  return { x, y, width, height }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function clampLayout(layout: PopoutLayout): PopoutLayout {
  const { maxWidth, maxHeight } = getViewportBounds()
  const width = clamp(layout.width, MIN_WIDTH, maxWidth)
  const height = clamp(layout.height, MIN_HEIGHT, maxHeight)
  const maxX = Math.max(EDGE_PADDING, window.innerWidth - width - EDGE_PADDING)
  const maxY = Math.max(EDGE_PADDING, window.innerHeight - height - EDGE_PADDING)
  const x = clamp(layout.x, EDGE_PADDING, maxX)
  const y = clamp(layout.y, EDGE_PADDING, maxY)
  return { x, y, width, height }
}

function loadLayout(): PopoutLayout {
  if (typeof window === 'undefined') {
    return { x: 16, y: 16, width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT }
  }

  const fallback = createDefaultLayout()
  const serialized = window.localStorage.getItem(STORAGE_KEY)
  if (!serialized) return fallback

  try {
    const parsed = JSON.parse(serialized) as Partial<PopoutLayout>
    if (
      typeof parsed.x !== 'number' ||
      typeof parsed.y !== 'number' ||
      typeof parsed.width !== 'number' ||
      typeof parsed.height !== 'number'
    ) {
      return fallback
    }
    return clampLayout({
      x: parsed.x,
      y: parsed.y,
      width: parsed.width,
      height: parsed.height
    })
  } catch {
    return fallback
  }
}

export function LiveStreamPopoutProvider({ children }: { children: ReactNode }) {
  const [popout, setPopout] = useState<LiveStreamPopoutPayload | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [layout, setLayout] = useState<PopoutLayout>(() => loadLayout())
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [volume, setVolume] = useState(1)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [showControls, setShowControls] = useState(true)
  const layoutRef = useRef(layout)
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlHideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sourceIdRef = useRef(`live-stream-popout-${Math.random().toString(36).slice(2)}`)

  useEffect(() => {
    layoutRef.current = layout
  }, [layout])

  const clearControlHideTimeout = useCallback(() => {
    if (!controlHideTimeoutRef.current) return
    clearTimeout(controlHideTimeoutRef.current)
    controlHideTimeoutRef.current = null
  }, [])

  const scheduleControlHide = useCallback(() => {
    clearControlHideTimeout()
    if (!isPlaying || isDragging || isResizing) {
      return
    }
    controlHideTimeoutRef.current = setTimeout(() => {
      setShowControls(false)
      controlHideTimeoutRef.current = null
    }, CONTROL_HIDE_DELAY)
  }, [clearControlHideTimeout, isDragging, isPlaying, isResizing])

  const revealControls = useCallback(() => {
    setShowControls(true)
    scheduleControlHide()
  }, [scheduleControlHide])

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layout))
  }, [layout])

  useEffect(() => {
    const handleResize = () => {
      setLayout((previous) => clampLayout(previous))
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (!isOpen || !popout) {
      clearControlHideTimeout()
      return
    }

    setShowControls(true)
    scheduleControlHide()
    return () => {
      clearControlHideTimeout()
    }
  }, [clearControlHideTimeout, isOpen, popout, scheduleControlHide])

  const openPopout = useCallback((payload: LiveStreamPopoutPayload) => {
    setPopout(payload)
    setIsOpen(true)
    setLayout((previous) => clampLayout(previous))
  }, [])

  const closePopout = useCallback(() => {
    const video = videoRef.current
    if (video && !video.paused) {
      video.pause()
    }
    clearControlHideTimeout()
    setIsOpen(false)
  }, [clearControlHideTimeout])

  const isPopoutOpenForUrl = useCallback(
    (streamingUrl?: string) => {
      if (!streamingUrl || !popout || !isOpen) return false
      return popout.streamingUrl === streamingUrl
    },
    [isOpen, popout]
  )

  const handleDragStart = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    if ((event.target as HTMLElement).closest('button')) return

    event.preventDefault()
    const pointerId = event.pointerId
    const startX = event.clientX
    const startY = event.clientY
    const { x: originX, y: originY } = layoutRef.current

    setIsDragging(true)

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return
      const nextX = originX + (moveEvent.clientX - startX)
      const nextY = originY + (moveEvent.clientY - startY)
      setLayout((previous) =>
        clampLayout({
          ...previous,
          x: nextX,
          y: nextY
        })
      )
    }

    const handlePointerUp = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== pointerId) return
      setIsDragging(false)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)
  }, [])

  const handleResizeStart = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()

    const pointerId = event.pointerId
    const startX = event.clientX
    const startY = event.clientY
    const { width: originWidth, height: originHeight } = layoutRef.current

    setIsResizing(true)

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return
      const nextWidth = originWidth + (moveEvent.clientX - startX)
      const nextHeight = originHeight + (moveEvent.clientY - startY)
      setLayout((previous) =>
        clampLayout({
          ...previous,
          width: nextWidth,
          height: nextHeight
        })
      )
    }

    const handlePointerUp = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== pointerId) return
      setIsResizing(false)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)
  }, [])

  const togglePlayback = useCallback(async () => {
    const video = videoRef.current
    if (!video || !popout?.streamingUrl) return

    try {
      if (video.paused) {
        await video.play()
        liveStreamSyncService.setState(popout.streamingUrl, { isPlaying: true })
        liveStreamSyncService.dispatchCommand({
          streamingUrl: popout.streamingUrl,
          action: 'play',
          sourceId: sourceIdRef.current
        })
      } else {
        video.pause()
        liveStreamSyncService.setState(popout.streamingUrl, { isPlaying: false })
        liveStreamSyncService.dispatchCommand({
          streamingUrl: popout.streamingUrl,
          action: 'pause',
          sourceId: sourceIdRef.current
        })
      }
    } catch (error) {
      console.error('Failed to toggle popout playback:', error)
    }
  }, [popout?.streamingUrl])

  const toggleMute = useCallback(() => {
    const video = videoRef.current
    if (!video || !popout?.streamingUrl) return

    video.muted = !video.muted
    setIsMuted(video.muted)
    liveStreamSyncService.setState(popout.streamingUrl, { isMuted: video.muted })
    liveStreamSyncService.dispatchCommand({
      streamingUrl: popout.streamingUrl,
      action: 'set-muted',
      muted: video.muted,
      sourceId: sourceIdRef.current
    })
  }, [popout?.streamingUrl])

  const handleVolumeChange = useCallback((values: number[]) => {
    const video = videoRef.current
    if (!video) return

    const nextVolume = values[0] ?? 1
    video.volume = nextVolume
    if (nextVolume > 0 && video.muted) {
      video.muted = false
    }
    setVolume(nextVolume)
    setIsMuted(video.muted)
  }, [])

  const handleSeek = useCallback((values: number[]) => {
    const video = videoRef.current
    if (!video) return

    const nextTime = values[0] ?? 0
    video.currentTime = nextTime
    setCurrentTime(nextTime)
  }, [])

  const enforceCustomControls = useCallback(() => {
    const video = videoRef.current
    if (!video) return

    if (video.controls) {
      video.controls = false
    }
    video.removeAttribute('controls')
  }, [])

  useEffect(() => {
    if (!isOpen || !popout) return

    const video = videoRef.current
    if (!video) return

    video.volume = volume
    video.muted = isMuted
    enforceCustomControls()
  }, [enforceCustomControls, isMuted, isOpen, popout, volume])

  useEffect(() => {
    if (!isOpen || !popout) return

    const video = videoRef.current
    if (!video) return

    enforceCustomControls()

    const events: Array<keyof HTMLMediaElementEventMap> = ['loadedmetadata', 'canplay', 'play', 'emptied']
    events.forEach((eventName) => video.addEventListener(eventName, enforceCustomControls))

    const mutationObserver = new MutationObserver(() => enforceCustomControls())
    mutationObserver.observe(video, { attributes: true, attributeFilter: ['controls'] })

    return () => {
      events.forEach((eventName) => video.removeEventListener(eventName, enforceCustomControls))
      mutationObserver.disconnect()
    }
  }, [enforceCustomControls, isOpen, popout])

  useEffect(() => {
    if (!isOpen) return
    if (!isPlaying) {
      clearControlHideTimeout()
      setShowControls(true)
      return
    }
    scheduleControlHide()
  }, [clearControlHideTimeout, isOpen, isPlaying, scheduleControlHide])

  useEffect(() => {
    if (!isOpen || !popout?.streamingUrl) return

    const handleCommand = (event: Event) => {
      const customEvent = event as CustomEvent<TLiveStreamSyncCommand>
      const command = customEvent.detail

      if (!command || command.streamingUrl !== popout.streamingUrl) return
      if (command.sourceId === sourceIdRef.current) return

      const video = videoRef.current
      if (!video) return

      if (command.action === 'play') {
        video.play().then(() => {
          liveStreamSyncService.setState(popout.streamingUrl, { isPlaying: true })
        }).catch(() => {
          setIsPlaying(false)
          liveStreamSyncService.setState(popout.streamingUrl, { isPlaying: false })
        })
        return
      }
      if (command.action === 'pause') {
        video.pause()
        setIsPlaying(false)
        liveStreamSyncService.setState(popout.streamingUrl, { isPlaying: false })
        return
      }
      if (command.action === 'set-muted') {
        video.muted = !!command.muted
        setIsMuted(video.muted)
        liveStreamSyncService.setState(popout.streamingUrl, { isMuted: video.muted })
      }
    }

    liveStreamSyncService.addEventListener('command', handleCommand as EventListener)
    return () => {
      liveStreamSyncService.removeEventListener('command', handleCommand as EventListener)
    }
  }, [isOpen, popout?.streamingUrl])

  const contextValue = useMemo<LiveStreamPopoutContextValue>(
    () => ({
      popout,
      isOpen,
      openPopout,
      closePopout,
      isPopoutOpenForUrl
    }),
    [closePopout, isOpen, isPopoutOpenForUrl, openPopout, popout]
  )

  const hasDuration = Number.isFinite(duration) && duration > 0
  const volumeValue = isMuted ? 0 : volume

  const overlay = isOpen && popout
    ? createPortal(
        <div className="fixed inset-0 z-[80] pointer-events-none">
          <div
            className="group absolute pointer-events-auto overflow-hidden rounded-lg border border-border/80 bg-black shadow-2xl"
            style={{
              width: layout.width,
              height: layout.height,
              transform: `translate3d(${layout.x}px, ${layout.y}px, 0)`
            }}
            onPointerMove={revealControls}
            onTouchStart={revealControls}
            onMouseLeave={scheduleControlHide}
          >
            <div className="relative h-full w-full bg-black">
              <video
                ref={videoRef}
                src={popout.streamingUrl}
                poster={popout.image}
                autoPlay
                controls={false}
                playsInline
                className="popout-stream-video h-full w-full bg-black object-contain"
                onClick={togglePlayback}
                onPlay={() => {
                  setIsPlaying(true)
                  liveStreamSyncService.setState(popout.streamingUrl, { isPlaying: true })
                }}
                onPause={() => {
                  setIsPlaying(false)
                  liveStreamSyncService.setState(popout.streamingUrl, { isPlaying: false })
                }}
                onEnded={() => {
                  setIsPlaying(false)
                  liveStreamSyncService.setState(popout.streamingUrl, { isPlaying: false })
                }}
                onLoadedMetadata={(event) => {
                  const nextDuration = event.currentTarget.duration
                  setDuration(Number.isFinite(nextDuration) ? nextDuration : 0)
                  setCurrentTime(event.currentTarget.currentTime)
                  setVolume(event.currentTarget.volume)
                  setIsMuted(event.currentTarget.muted)
                  liveStreamSyncService.setState(popout.streamingUrl, {
                    isPlaying: !event.currentTarget.paused,
                    isMuted: event.currentTarget.muted
                  })
                }}
                onDurationChange={(event) => {
                  const nextDuration = event.currentTarget.duration
                  setDuration(Number.isFinite(nextDuration) ? nextDuration : 0)
                }}
                onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
                onVolumeChange={(event) => {
                  setVolume(event.currentTarget.volume)
                  setIsMuted(event.currentTarget.muted)
                  liveStreamSyncService.setState(popout.streamingUrl, {
                    isMuted: event.currentTarget.muted
                  })
                }}
              />

              <div
                className={`pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/80 via-black/45 to-transparent px-2 py-1.5 transition-opacity duration-200 ${
                  showControls || isDragging ? 'opacity-100' : 'opacity-0'
                }`}
              >
                <div
                  className={`pointer-events-auto flex h-8 items-center justify-between gap-2 rounded-md bg-black/45 px-2 text-white backdrop-blur-sm ${
                    isDragging ? 'cursor-grabbing' : 'cursor-move'
                  }`}
                  onPointerDown={handleDragStart}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <PictureInPicture2 className="h-3.5 w-3.5 shrink-0 text-white/70" />
                    <span className="truncate text-xs font-medium">{popout.title}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-white/80 hover:bg-white/10 hover:text-white"
                    onClick={closePopout}
                    title="Close popout"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <div
                className={`pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/65 to-transparent px-2 pb-2 pt-8 transition-opacity duration-200 ${
                  showControls || !isPlaying || isResizing ? 'opacity-100' : 'opacity-0'
                }`}
              >
                <div className="pointer-events-auto flex items-center gap-2 text-white">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-white/85 hover:bg-white/10 hover:text-white"
                    onClick={() => {
                      revealControls()
                      togglePlayback()
                    }}
                    title={isPlaying ? 'Pause' : 'Play'}
                  >
                    {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>

                  {hasDuration ? (
                    <>
                      <span className="w-10 shrink-0 text-[11px] tabular-nums text-white/75">
                        {formatMediaTime(currentTime)}
                      </span>
                      <Slider
                        value={[Math.min(currentTime, duration)]}
                        max={duration}
                        step={1}
                        onValueChange={(values) => {
                          revealControls()
                          handleSeek(values)
                        }}
                        className="min-w-0 flex-1"
                      />
                      <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-white/75">
                        {formatMediaTime(duration)}
                      </span>
                    </>
                  ) : (
                    <div className="flex min-w-0 flex-1 items-center">
                      <span className="rounded-sm border border-red-500/70 px-1.5 py-0.5 text-[10px] font-semibold text-red-400">
                        LIVE
                      </span>
                    </div>
                  )}

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-white/85 hover:bg-white/10 hover:text-white"
                    onClick={() => {
                      revealControls()
                      toggleMute()
                    }}
                    title={isMuted ? 'Unmute' : 'Mute'}
                  >
                    {isMuted || volumeValue === 0 ? (
                      <VolumeX className="h-4 w-4" />
                    ) : (
                      <Volume2 className="h-4 w-4" />
                    )}
                  </Button>
                  <Slider
                    value={[volumeValue]}
                    max={1}
                    step={0.01}
                    onValueChange={(values) => {
                      revealControls()
                      handleVolumeChange(values)
                    }}
                    className="w-24 shrink-0"
                  />
                </div>
              </div>
            </div>

            <button
              type="button"
              className={`absolute bottom-1.5 right-1.5 h-5 w-5 cursor-se-resize rounded bg-black/40 p-0.5 text-white/70 transition-opacity ${
                showControls || isResizing ? 'opacity-100' : 'opacity-35 group-hover:opacity-65'
              }`}
              onPointerDown={handleResizeStart}
              onPointerMove={revealControls}
              aria-label="Resize popout player"
              title="Resize"
            >
              <svg viewBox="0 0 16 16" fill="none" className="h-full w-full">
                <path d="M3 13L13 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                <path d="M7 13L13 7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                <path d="M11 13L13 11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>,
        document.body
      )
    : null

  return (
    <LiveStreamPopoutContext.Provider value={contextValue}>
      {children}
      {overlay}
    </LiveStreamPopoutContext.Provider>
  )
}

export function useLiveStreamPopout() {
  const context = useContext(LiveStreamPopoutContext)
  if (!context) {
    throw new Error('useLiveStreamPopout must be used within a LiveStreamPopoutProvider')
  }
  return context
}

function formatMediaTime(time: number) {
  if (!Number.isFinite(time) || time < 0) return '0:00'
  const minutes = Math.floor(time / 60)
  const seconds = Math.floor(time % 60)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}
