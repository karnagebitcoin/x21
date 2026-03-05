import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Event as NostrEvent, nip19 } from 'nostr-tools'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Slider } from '@/components/ui/slider'
import { Textarea } from '@/components/ui/textarea'
import {
  Radio,
  Users,
  Send,
  Zap as ZapIcon,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Pin,
  PictureInPicture2,
  Maximize2,
  Minimize2
} from 'lucide-react'
import UserAvatar from '@/components/UserAvatar'
import Username from '@/components/Username'
import Content from '@/components/Content'
import { FormattedTimestamp } from '@/components/FormattedTimestamp'
import client from '@/services/client.service'
import { useNostr } from '@/providers/NostrProvider'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { useSecondaryPage } from '@/PageManager'
import { formatAmount } from '@/lib/lightning'
import { getZapInfoFromEvent } from '@/lib/event-metadata'
import ZapDialog from '@/components/ZapDialog'
import RelayFetchState from '@/components/RelayFetchState'
import { BIG_RELAY_URLS } from '@/constants'
import { normalizeUrl } from '@/lib/url'
import { useLiveStreamPopout } from '@/providers/LiveStreamPopoutProvider'
import { useWidgets } from '@/providers/WidgetsProvider'
import liveStreamSyncService, { TLiveStreamSyncCommand } from '@/services/live-stream-sync.service'

const DEFAULT_LIVE_RELAYS = ['wss://relay.damus.io/', 'wss://nos.lol/', 'wss://relay.nostr.band/']
const FAST_LIVE_RELAYS = ['wss://relay.snort.social/', 'wss://relay.primal.net/', 'wss://nostr.wine/']
const LIVE_STREAM_LOADING_TIMEOUT = 15_000

type DecodedLiveAddress = {
  identifier: string
  pubkey: string
  kind: number
  relays?: string[]
}

type LiveZap = {
  id: string
  pubkey: string
  amount: number
  created_at: number
  comment?: string
}

function decodeLiveNaddr(naddr?: string): DecodedLiveAddress | null {
  if (!naddr) return null

  try {
    const decoded = nip19.decode(naddr)
    if (decoded.type !== 'naddr') return null
    return decoded.data as DecodedLiveAddress
  } catch {
    return null
  }
}

function getAddressTag(decoded: DecodedLiveAddress): string {
  return `${decoded.kind}:${decoded.pubkey}:${decoded.identifier}`
}

function getEventTagValue(event: NostrEvent, tagName: string): string | undefined {
  return event.tags.find((tag) => tag[0] === tagName)?.[1]
}

function isMatchingLiveAddress(event: NostrEvent, decoded: DecodedLiveAddress): boolean {
  return (
    event.kind === decoded.kind &&
    event.pubkey === decoded.pubkey &&
    getEventTagValue(event, 'd') === decoded.identifier
  )
}

function getStreamRelays(decoded: DecodedLiveAddress): string[] {
  const relayCandidates = [
    ...(decoded.relays ?? []),
    ...DEFAULT_LIVE_RELAYS,
    ...BIG_RELAY_URLS,
    'wss://relay.snort.social/',
    'wss://relay.primal.net/',
    'wss://nostr.wine/'
  ]

  const normalized = relayCandidates
    .map((relay) => normalizeUrl(relay))
    .filter((relay): relay is string => relay.length > 0)

  return Array.from(new Set(normalized))
}

function getPrimaryStreamRelays(decoded: DecodedLiveAddress, initialEvent?: NostrEvent): string[] {
  const eventRelayHints = initialEvent?.tags.find((tag) => tag[0] === 'relays')?.slice(1) ?? []
  const relayCandidates = [
    ...eventRelayHints,
    ...(decoded.relays ?? []),
    ...DEFAULT_LIVE_RELAYS,
    ...FAST_LIVE_RELAYS
  ]

  const normalized = relayCandidates
    .map((relay) => normalizeUrl(relay))
    .filter((relay): relay is string => relay.length > 0)

  return Array.from(new Set(normalized)).slice(0, 3)
}

export default function LiveStreamView({
  naddr,
  initialEvent
}: {
  naddr?: string
  initialEvent?: NostrEvent
}) {
  const { t } = useTranslation()
  const { pubkey, checkLogin, publish } = useNostr()
  const { openPopout, isPopoutOpenForUrl } = useLiveStreamPopout()
  const { pinLiveStreamWidget, unpinLiveStreamByNaddr, isLiveStreamPinned } = useWidgets()
  const { isSmallScreen } = useScreenSize()
  const decodedEvent = useMemo(() => decodeLiveNaddr(naddr), [naddr])
  const [liveEvent, setLiveEvent] = useState<NostrEvent | null>(null)
  const [chatMessages, setChatMessages] = useState<NostrEvent[]>([])
  const [zaps, setZaps] = useState<LiveZap[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showSlowLoading, setShowSlowLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isStreamZapOpen, setIsStreamZapOpen] = useState(false)
  const [isAboutOpen, setIsAboutOpen] = useState(false)
  const [isVideoPlaying, setIsVideoPlaying] = useState(false)
  const [isVideoMuted, setIsVideoMuted] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const prevChatCountRef = useRef(0)
  const autoScrollRef = useRef(true)
  const chatScrollRafRef = useRef<number | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const videoContainerRef = useRef<HTMLDivElement>(null)
  const sourceIdRef = useRef(`live-stream-view-${Math.random().toString(36).slice(2)}`)
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const slowLoadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [showTimelineLabels, setShowTimelineLabels] = useState(false)
  const activeStreamingUrl = useMemo(
    () => liveEvent?.tags.find((tag) => tag[0] === 'streaming')?.[1],
    [liveEvent]
  )
  const isInPopout = isPopoutOpenForUrl(activeStreamingUrl)
  const isPinnedToWidget = isLiveStreamPinned(naddr)

  const clearLoadingTimeout = useCallback(() => {
    if (!loadingTimeoutRef.current) return
    clearTimeout(loadingTimeoutRef.current)
    loadingTimeoutRef.current = null
  }, [])

  const clearSlowLoadingTimeout = useCallback(() => {
    if (!slowLoadingTimeoutRef.current) return
    clearTimeout(slowLoadingTimeoutRef.current)
    slowLoadingTimeoutRef.current = null
  }, [])

  const relayCount = useMemo(
    () => (decodedEvent ? getStreamRelays(decodedEvent).length : 0),
    [decodedEvent]
  )

  useEffect(() => {
    if (!decodedEvent) {
      clearLoadingTimeout()
      clearSlowLoadingTimeout()
      setIsLoading(false)
      setShowSlowLoading(false)
      setLiveEvent(null)
      setChatMessages([])
      setZaps([])
      setCurrentTime(0)
      setDuration(0)
      setIsVideoPlaying(false)
      return
    }

    const relays = getStreamRelays(decodedEvent)
    const primaryRelays = getPrimaryStreamRelays(decodedEvent, initialEvent).filter((relay) =>
      relays.includes(relay)
    )
    const seedRelays = primaryRelays.length > 0 ? primaryRelays : relays.slice(0, 3)
    const fallbackRelays = relays.filter((relay) => !seedRelays.includes(relay))
    const addressTag = getAddressTag(decodedEvent)
    const hydratedInitialEvent =
      initialEvent && isMatchingLiveAddress(initialEvent, decodedEvent) ? initialEvent : null
    const closers: Array<{ close: () => void }> = []
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null
    let isDisposed = false
    let hasLiveEvent = !!hydratedInitialEvent

    clearLoadingTimeout()
    clearSlowLoadingTimeout()
    setIsLoading(!hydratedInitialEvent)
    setShowSlowLoading(false)
    setLiveEvent(hydratedInitialEvent)
    setChatMessages([])
    setZaps([])
    setCurrentTime(0)
    setDuration(0)
    setIsVideoPlaying(false)

    if (!hydratedInitialEvent) {
      // Keep loading state a bit longer to avoid false "not found" flashes on slow relays.
      loadingTimeoutRef.current = setTimeout(() => {
        setIsLoading(false)
        loadingTimeoutRef.current = null
      }, LIVE_STREAM_LOADING_TIMEOUT)
      slowLoadingTimeoutRef.current = setTimeout(() => {
        setShowSlowLoading(true)
        slowLoadingTimeoutRef.current = null
      }, 3500)
    }

    const applyLiveEvent = (event: NostrEvent) => {
      hasLiveEvent = true
      setLiveEvent((previous) => {
        if (!previous) return event
        return event.created_at > previous.created_at ? event : previous
      })
      setIsLoading(false)
      setShowSlowLoading(false)
      clearLoadingTimeout()
      clearSlowLoadingTimeout()
    }

    const subscribeToRelays = (targetRelays: string[]) => {
      if (targetRelays.length === 0) return

      const liveSub = client.subscribe(
        targetRelays,
        {
          kinds: [decodedEvent.kind],
          authors: [decodedEvent.pubkey],
          '#d': [decodedEvent.identifier],
          limit: 20
        },
        {
          onevent: (event: NostrEvent) => {
            applyLiveEvent(event)
          },
          oneose: () => {
            // Intentionally no-op: a quick EOSE should not immediately show "not found".
          }
        }
      )
      closers.push(liveSub)

      const chatSub = client.subscribe(
        targetRelays,
        {
          kinds: [1311],
          '#a': [addressTag],
          limit: 300
        },
        {
          onevent: (event: NostrEvent) => {
            setChatMessages((previous) => {
              if (previous.some((item) => item.id === event.id)) return previous
              return [...previous, event].sort((a, b) => a.created_at - b.created_at)
            })
          }
        }
      )
      closers.push(chatSub)

      const zapsSub = client.subscribe(
        targetRelays,
        {
          kinds: [9735],
          '#a': [addressTag],
          limit: 100
        },
        {
          onevent: (event: NostrEvent) => {
            const zapInfo = getZapInfoFromEvent(event)
            if (!zapInfo?.amount || !zapInfo.senderPubkey) return

            const senderPubkey = zapInfo.senderPubkey
            const amount = zapInfo.amount

            setZaps((previous) => {
              if (previous.some((item) => item.id === event.id)) return previous

              const nextZap: LiveZap = {
                id: event.id,
                pubkey: senderPubkey,
                amount,
                created_at: event.created_at,
                comment: zapInfo.comment
              }
              return [...previous, nextZap].sort((a, b) => b.created_at - a.created_at)
            })
          }
        }
      )
      closers.push(zapsSub)
    }

    const queryLiveEvent = (targetRelays: string[]) =>
      client
        .querySync(targetRelays, {
          kinds: [decodedEvent.kind],
          authors: [decodedEvent.pubkey],
          '#d': [decodedEvent.identifier],
          limit: 10
        })
        .then((events) => {
          if (isDisposed || events.length === 0) return false
          const latest = events.sort((a, b) => b.created_at - a.created_at)[0]
          if (!latest) return false
          applyLiveEvent(latest)
          return true
        })
        .catch(() => false)

    // Fast first: hit a small relay tier immediately for stream metadata/chat/zaps.
    subscribeToRelays(seedRelays)
    queryLiveEvent(seedRelays).then((found) => {
      if (!found && fallbackRelays.length > 0) {
        queryLiveEvent(fallbackRelays)
      }
    })

    // Then widen to all stream relays for completeness.
    if (fallbackRelays.length > 0) {
      fallbackTimer = setTimeout(() => {
        if (isDisposed) return
        subscribeToRelays(fallbackRelays)
        if (!hasLiveEvent) {
          queryLiveEvent(fallbackRelays)
        }
      }, hydratedInitialEvent ? 2500 : 1200)
    }

    return () => {
      isDisposed = true
      clearLoadingTimeout()
      clearSlowLoadingTimeout()
      if (fallbackTimer) {
        clearTimeout(fallbackTimer)
      }
      closers.forEach((closer) => closer.close())
    }
  }, [clearLoadingTimeout, clearSlowLoadingTimeout, decodedEvent, initialEvent, loadAttempt])

  const scrollChatToBottom = useCallback(() => {
    const container = chatContainerRef.current
    if (!container) return
    container.scrollTop = container.scrollHeight
  }, [])

  const scheduleScrollChatToBottom = useCallback(() => {
    if (chatScrollRafRef.current !== null) {
      cancelAnimationFrame(chatScrollRafRef.current)
    }
    chatScrollRafRef.current = requestAnimationFrame(() => {
      scrollChatToBottom()
      chatScrollRafRef.current = null
    })
  }, [scrollChatToBottom])

  useEffect(() => {
    return () => {
      clearLoadingTimeout()
      clearSlowLoadingTimeout()
      if (chatScrollRafRef.current !== null) {
        cancelAnimationFrame(chatScrollRafRef.current)
      }
    }
  }, [clearLoadingTimeout, clearSlowLoadingTimeout])

  useEffect(() => {
    const count = chatMessages.length
    const prevCount = prevChatCountRef.current

    if (count === 0) {
      prevChatCountRef.current = 0
      return
    }

    // Jump once after initial load, then only keep autoscrolling if user stays near bottom.
    if (prevCount === 0 || (count > prevCount && autoScrollRef.current)) {
      scheduleScrollChatToBottom()
    }

    prevChatCountRef.current = count
  }, [chatMessages.length, scheduleScrollChatToBottom])

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === videoContainerRef.current)
    }

    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange)
    }
  }, [])

  useEffect(() => {
    const container = videoContainerRef.current
    if (!container || typeof ResizeObserver === 'undefined') return

    const update = () => {
      setShowTimelineLabels(container.clientWidth >= 700)
    }

    update()
    const observer = new ResizeObserver(update)
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  const sendMessage = useCallback(async () => {
    if (!message.trim() || !decodedEvent || !pubkey) {
      await checkLogin()
      return
    }

    setIsSending(true)

    try {
      const draft = {
        kind: 1311,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['a', getAddressTag(decodedEvent), '', 'root']],
        content: message.trim()
      }

      const relays =
        decodedEvent.relays && decodedEvent.relays.length > 0
          ? decodedEvent.relays
          : DEFAULT_LIVE_RELAYS

      await publish(draft, { additionalRelayUrls: relays })
      setMessage('')
      autoScrollRef.current = true
      scheduleScrollChatToBottom()
    } catch (error) {
      console.error('Failed to send live chat message:', error)
    } finally {
      setIsSending(false)
    }
  }, [message, decodedEvent, pubkey, checkLogin, publish, scheduleScrollChatToBottom])

  const zapLiveEvent = useCallback(() => {
    if (!liveEvent) return
    setIsStreamZapOpen(true)
  }, [liveEvent])

  const toggleVideoPlayback = useCallback(async () => {
    if (isInPopout) return

    const video = videoRef.current
    if (!video || !activeStreamingUrl) return

    try {
      if (video.paused) {
        await video.play()
        liveStreamSyncService.setState(activeStreamingUrl, { isPlaying: true })
        liveStreamSyncService.dispatchCommand({
          streamingUrl: activeStreamingUrl,
          action: 'play',
          sourceId: sourceIdRef.current
        })
      } else {
        video.pause()
        liveStreamSyncService.setState(activeStreamingUrl, { isPlaying: false })
        liveStreamSyncService.dispatchCommand({
          streamingUrl: activeStreamingUrl,
          action: 'pause',
          sourceId: sourceIdRef.current
        })
      }
    } catch (error) {
      console.error('Failed to toggle video playback:', error)
    }
  }, [activeStreamingUrl, isInPopout])

  const toggleVideoMute = useCallback(() => {
    const video = videoRef.current
    if (!video || !activeStreamingUrl) return
    video.muted = !video.muted
    setIsVideoMuted(video.muted)
    liveStreamSyncService.setState(activeStreamingUrl, { isMuted: video.muted })
    liveStreamSyncService.dispatchCommand({
      streamingUrl: activeStreamingUrl,
      action: 'set-muted',
      muted: video.muted,
      sourceId: sourceIdRef.current
    })
  }, [activeStreamingUrl])

  const handleSeek = useCallback((value: number[]) => {
    const video = videoRef.current
    if (!video) return

    const next = value[0] ?? 0
    video.currentTime = next
    setCurrentTime(next)
  }, [])

  const toggleFullscreen = useCallback(async () => {
    const container = videoContainerRef.current
    if (!container) return

    try {
      if (document.fullscreenElement === container) {
        await document.exitFullscreen()
      } else {
        await container.requestFullscreen()
      }
    } catch (error) {
      console.error('Failed to toggle fullscreen:', error)
    }
  }, [])

  useEffect(() => {
    if (!isInPopout) return

    const video = videoRef.current
    if (!video || !activeStreamingUrl) return

    if (!video.paused) {
      video.pause()
      liveStreamSyncService.setState(activeStreamingUrl, { isPlaying: false })
      liveStreamSyncService.dispatchCommand({
        streamingUrl: activeStreamingUrl,
        action: 'pause',
        sourceId: sourceIdRef.current
      })
    }
    setIsVideoPlaying(false)
  }, [activeStreamingUrl, isInPopout])

  useEffect(() => {
    if (!activeStreamingUrl) return

    const handleCommand = (event: Event) => {
      const customEvent = event as CustomEvent<TLiveStreamSyncCommand>
      const command = customEvent.detail

      if (!command || command.streamingUrl !== activeStreamingUrl) return
      if (command.sourceId === sourceIdRef.current) return

      const video = videoRef.current
      if (!video) return

      if (command.action === 'play') {
        if (isInPopout) return
        video.play().then(() => {
          liveStreamSyncService.setState(activeStreamingUrl, { isPlaying: true })
        }).catch(() => {
          setIsVideoPlaying(false)
          liveStreamSyncService.setState(activeStreamingUrl, { isPlaying: false })
        })
        return
      }
      if (command.action === 'pause') {
        video.pause()
        setIsVideoPlaying(false)
        liveStreamSyncService.setState(activeStreamingUrl, { isPlaying: false })
        return
      }
      if (command.action === 'set-muted') {
        video.muted = !!command.muted
        setIsVideoMuted(video.muted)
        liveStreamSyncService.setState(activeStreamingUrl, { isMuted: video.muted })
      }
    }

    liveStreamSyncService.addEventListener('command', handleCommand as EventListener)
    return () => {
      liveStreamSyncService.removeEventListener('command', handleCommand as EventListener)
    }
  }, [activeStreamingUrl, isInPopout])

  if (isLoading) {
    if (showSlowLoading) {
      return (
        <RelayFetchState
          mode="slow"
          relayCount={relayCount}
          onRetry={() => setLoadAttempt((prev) => prev + 1)}
          className="h-[calc(100dvh-8rem)]"
        />
      )
    }

    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="aspect-video w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    )
  }

  if (!liveEvent || !decodedEvent) {
    return (
      <RelayFetchState
        mode="not-found"
        relayCount={relayCount}
        onRetry={() => setLoadAttempt((prev) => prev + 1)}
        className="h-[calc(100dvh-8rem)]"
      />
    )
  }

  const title = liveEvent.tags.find((tag) => tag[0] === 'title')?.[1] || t('Untitled Live Stream')
  const summary = liveEvent.tags.find((tag) => tag[0] === 'summary')?.[1]
  const image = liveEvent.tags.find((tag) => tag[0] === 'image')?.[1]
  const streamingUrl = activeStreamingUrl
  const currentParticipants = liveEvent.tags.find((tag) => tag[0] === 'current_participants')?.[1]
  const status = liveEvent.tags.find((tag) => tag[0] === 'status')?.[1]
  const hasDuration = Number.isFinite(duration) && duration > 0
  const handleChatScroll = () => {
    const container = chatContainerRef.current
    if (!container) return
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight
    autoScrollRef.current = distanceFromBottom <= 48
  }

  return (
    <div className="h-[calc(100dvh-4rem)] w-full min-w-0 max-w-full flex flex-col overflow-hidden overflow-x-hidden">
      <div className="shrink-0 border-b px-3 py-1.5 bg-background">
        <div className="flex items-center gap-2 min-w-0">
          <UserAvatar userId={liveEvent.pubkey} size="small" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0 text-xs text-muted-foreground">
              <Username userId={liveEvent.pubkey} noLink className="truncate" />
              <Badge variant="destructive" className="bg-red-600 text-white flex items-center gap-1">
                <Radio className="w-3 h-3 animate-pulse" />
                {status === 'live' ? t('LIVE') : status?.toUpperCase()}
              </Badge>
              {currentParticipants && (
                <span className="inline-flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {currentParticipants} {t('watching')}
                </span>
              )}
            </div>
          </div>
          {summary && (
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0"
              onClick={() => setIsAboutOpen((previous) => !previous)}
            >
              {t('About')} {isAboutOpen ? '−' : '+'}
            </Button>
          )}
          <Button onClick={zapLiveEvent} size="icon" className="h-8 w-8 shrink-0" title={t('Zap this stream')}>
            <ZapIcon className="w-4 h-4" />
          </Button>
        </div>
        {summary && isAboutOpen && <p className="mt-2 text-sm text-muted-foreground">{summary}</p>}
      </div>

      <div className="flex-1 min-h-0 min-w-0 grid grid-rows-[minmax(220px,42vh)_minmax(0,1fr)]">
        <div className="min-h-0 min-w-0 bg-black border-b flex flex-col overflow-x-hidden">
          {streamingUrl ? (
            <>
              <div
                ref={videoContainerRef}
                className="relative flex-1 min-h-0 min-w-0 bg-black overflow-hidden"
              >
                <video
                  ref={videoRef}
                  src={streamingUrl}
                  autoPlay
                  playsInline
                  className="w-full h-full object-contain"
                  onPlay={(event) => {
                    if (isInPopout) {
                      event.currentTarget.pause()
                      setIsVideoPlaying(false)
                      if (activeStreamingUrl) {
                        liveStreamSyncService.setState(activeStreamingUrl, { isPlaying: false })
                      }
                      return
                    }
                    setIsVideoPlaying(true)
                    if (activeStreamingUrl) {
                      liveStreamSyncService.setState(activeStreamingUrl, { isPlaying: true })
                    }
                  }}
                  onPause={() => {
                    setIsVideoPlaying(false)
                    if (activeStreamingUrl) {
                      liveStreamSyncService.setState(activeStreamingUrl, { isPlaying: false })
                    }
                  }}
                  onEnded={() => {
                    setIsVideoPlaying(false)
                    if (activeStreamingUrl) {
                      liveStreamSyncService.setState(activeStreamingUrl, { isPlaying: false })
                    }
                  }}
                  onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
                  onLoadedMetadata={(event) => {
                    const nextDuration = event.currentTarget.duration
                    setDuration(Number.isFinite(nextDuration) ? nextDuration : 0)
                    setIsVideoMuted(event.currentTarget.muted)
                    if (activeStreamingUrl) {
                      liveStreamSyncService.setState(activeStreamingUrl, {
                        isMuted: event.currentTarget.muted,
                        isPlaying: !event.currentTarget.paused
                      })
                    }
                  }}
                  onDurationChange={(event) => {
                    const nextDuration = event.currentTarget.duration
                    setDuration(Number.isFinite(nextDuration) ? nextDuration : 0)
                  }}
                  onVolumeChange={(event) => {
                    setIsVideoMuted(event.currentTarget.muted)
                    if (activeStreamingUrl) {
                      liveStreamSyncService.setState(activeStreamingUrl, {
                        isMuted: event.currentTarget.muted
                      })
                    }
                  }}
                />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent p-2">
                  <div className="pointer-events-auto flex min-w-0 items-center gap-1.5 overflow-hidden text-white/90">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-white/80 hover:text-white hover:bg-white/10"
                      onClick={toggleVideoPlayback}
                    >
                      {isVideoPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-white/80 hover:text-white hover:bg-white/10"
                      onClick={toggleVideoMute}
                    >
                      {isVideoMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </Button>

                    <div className="flex min-w-0 flex-1 items-center gap-1.5">
                      {hasDuration ? (
                        <>
                          {showTimelineLabels && (
                            <span className="w-11 shrink-0 text-[11px] tabular-nums text-white/70">
                              {formatMediaTime(currentTime)}
                            </span>
                          )}
                          <Slider
                            value={[Math.min(currentTime, duration)]}
                            max={duration}
                            step={1}
                            onValueChange={handleSeek}
                            hideThumb
                            className="flex-1 min-w-0"
                          />
                          {showTimelineLabels && (
                            <span className="w-11 shrink-0 text-[11px] tabular-nums text-white/70 text-right">
                              {formatMediaTime(duration)}
                            </span>
                          )}
                        </>
                      ) : (
                        <div className="flex-1" />
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-8 w-8 shrink-0 text-white/80 hover:text-white hover:bg-white/10 ${
                          isInPopout ? 'bg-white/20 text-white' : ''
                        }`}
                        onClick={() => {
                          if (!streamingUrl) return
                          const video = videoRef.current
                          if (video) {
                            liveStreamSyncService.setState(streamingUrl, {
                              isMuted: video.muted,
                              isPlaying: !video.paused
                            })
                          }
                          if (video && !video.paused) {
                            video.pause()
                            setIsVideoPlaying(false)
                            liveStreamSyncService.dispatchCommand({
                              streamingUrl,
                              action: 'pause',
                              sourceId: sourceIdRef.current
                            })
                          }
                          openPopout({
                            streamingUrl,
                            title,
                            image,
                            naddr
                          })
                        }}
                        disabled={!streamingUrl}
                        title={isInPopout ? 'Popout player active' : 'Open popout player'}
                      >
                        <PictureInPicture2 className="w-4 h-4" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-8 w-8 shrink-0 text-white/80 hover:text-white hover:bg-white/10 ${
                          isPinnedToWidget ? 'bg-white/20 text-white' : ''
                        }`}
                        onClick={() => {
                          if (!naddr) return
                          if (isPinnedToWidget) {
                            unpinLiveStreamByNaddr(naddr)
                            return
                          }
                          if (!streamingUrl) return
                          pinLiveStreamWidget({
                            naddr,
                            streamingUrl,
                            title,
                            image
                          })
                        }}
                        disabled={!streamingUrl || !naddr}
                        title={isPinnedToWidget ? t('Pinned to widget') : t('Pin to widget')}
                      >
                        <Pin className="w-4 h-4" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-white/80 hover:text-white hover:bg-white/10"
                        onClick={toggleFullscreen}
                      >
                        {isFullscreen ? (
                          <Minimize2 className="w-4 h-4" />
                        ) : (
                          <Maximize2 className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : image ? (
            <img src={image} alt={title} className="w-full h-full object-contain" />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-sm text-muted-foreground">
              Stream source unavailable
            </div>
          )}
        </div>

        <div className="min-h-0 min-w-0 flex flex-col overflow-x-hidden">
          {zaps.length > 0 && (
            <div className="shrink-0 border-b px-2 py-1">
              <div className="flex gap-1 overflow-x-auto pb-0.5 scrollbar-thin">
                {zaps.slice(0, 20).map((zap) => (
                  <div
                    key={zap.id}
                    className="flex-shrink-0 flex items-center gap-1 bg-card border rounded-full px-2 py-0.5"
                  >
                    <UserAvatar userId={zap.pubkey} size="xSmall" />
                    <span className="text-xs font-semibold text-yellow-500">{formatAmount(zap.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="shrink-0 px-2.5 py-1.5 border-b font-semibold text-sm">
            {t('Live Chat')} ({chatMessages.length})
          </div>

          <div
            ref={chatContainerRef}
            onScroll={handleChatScroll}
            className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden px-2 py-1.5 space-y-0.5 scrollbar-thin"
          >
            {chatMessages.map((msg) => (
              <ChatMessage key={msg.id} event={msg} isSmallScreen={isSmallScreen} />
            ))}

            {chatMessages.length === 0 && (
              <div className="text-center text-sm text-muted-foreground py-8">
                {t('No messages yet. Be the first to chat!')}
              </div>
            )}
          </div>

          <div className="shrink-0 border-t px-2 py-1.5">
            <div className="flex gap-2 items-center">
              <Textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder={t('Type a message...')}
                className="h-9 min-h-0 max-h-20 resize-none py-1.5 text-sm leading-tight"
                rows={1}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    sendMessage()
                  }
                }}
              />
              <Button
                onClick={sendMessage}
                disabled={!message.trim() || isSending}
                size="icon"
                className="h-9 w-9 shrink-0"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {liveEvent && (
        <ZapDialog
          open={isStreamZapOpen}
          setOpen={setIsStreamZapOpen}
          pubkey={liveEvent.pubkey}
          event={liveEvent}
        />
      )}
    </div>
  )
}

function formatMediaTime(time: number) {
  if (!Number.isFinite(time) || time < 0) return '0:00'
  const minutes = Math.floor(time / 60)
  const seconds = Math.floor(time % 60)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function ChatMessage({
  event,
  isSmallScreen
}: {
  event: NostrEvent
  isSmallScreen: boolean
}) {
  const { push } = useSecondaryPage()

  return (
    <div className="flex w-full min-w-0 gap-1.5 group hover:bg-accent/50 px-1.5 py-1 rounded-md transition-colors">
      <button
        type="button"
        className="shrink-0 mt-0.5 cursor-pointer leading-none"
        onClick={() => push(`/users/${nip19.npubEncode(event.pubkey)}`)}
      >
        <UserAvatar userId={event.pubkey} size="xSmall" noLink />
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <button
            type="button"
            className="min-w-0 max-w-full truncate text-xs font-semibold cursor-pointer hover:underline leading-tight"
            onClick={() => push(`/users/${nip19.npubEncode(event.pubkey)}`)}
          >
            <Username userId={event.pubkey} noLink className="truncate" />
          </button>
          <FormattedTimestamp
            timestamp={event.created_at}
            className="text-xs text-muted-foreground"
            short={isSmallScreen}
          />
        </div>
        <Content content={event.content} className="text-xs mt-0.5 leading-snug overflow-hidden" />
      </div>
    </div>
  )
}
