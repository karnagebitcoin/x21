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
import { PictureInPicture2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

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
  const layoutRef = useRef(layout)

  useEffect(() => {
    layoutRef.current = layout
  }, [layout])

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

  const openPopout = useCallback((payload: LiveStreamPopoutPayload) => {
    setPopout(payload)
    setIsOpen(true)
    setLayout((previous) => clampLayout(previous))
  }, [])

  const closePopout = useCallback(() => {
    setIsOpen(false)
  }, [])

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

  const overlay = isOpen && popout
    ? createPortal(
        <div className="fixed inset-0 z-[80] pointer-events-none">
          <div
            className="absolute pointer-events-auto overflow-hidden rounded-lg border border-border/80 bg-black shadow-2xl"
            style={{
              width: layout.width,
              height: layout.height,
              transform: `translate3d(${layout.x}px, ${layout.y}px, 0)`
            }}
          >
            <div
              className={`flex h-10 items-center justify-between gap-2 border-b border-border/80 bg-black/90 px-2 text-white ${
                isDragging ? 'cursor-grabbing' : 'cursor-move'
              }`}
              onPointerDown={handleDragStart}
            >
              <div className="flex min-w-0 items-center gap-2">
                <PictureInPicture2 className="h-4 w-4 shrink-0 text-white/70" />
                <span className="truncate text-xs font-medium">{popout.title}</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-white/80 hover:bg-white/10 hover:text-white"
                onClick={closePopout}
                title="Close popout"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <video
              src={popout.streamingUrl}
              poster={popout.image}
              controls
              autoPlay
              playsInline
              className="h-[calc(100%-2.5rem)] w-full bg-black object-contain"
            />

            <button
              type="button"
              className={`absolute bottom-1.5 right-1.5 h-5 w-5 cursor-se-resize rounded bg-black/45 p-0.5 text-white/70 ${
                isResizing ? 'scale-110' : ''
              }`}
              onPointerDown={handleResizeStart}
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
