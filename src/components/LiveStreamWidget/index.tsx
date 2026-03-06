import WidgetContainer from '@/components/WidgetContainer'
import { Button } from '@/components/ui/button'
import { CardHeader, CardTitle } from '@/components/ui/card'
import { useSecondaryPage } from '@/PageManager'
import { useWidgets } from '@/providers/WidgetsProvider'
import mediaManager from '@/services/media-manager.service'
import liveStreamSyncService, { TLiveStreamSyncCommand } from '@/services/live-stream-sync.service'
import { Pause, Play, Radio, Volume2, VolumeX, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

type LiveStreamWidgetProps = {
  widgetId: string
  naddr: string
  streamingUrl: string
  title: string
  image?: string
}

export default function LiveStreamWidget({
  widgetId,
  naddr,
  streamingUrl,
  title,
  image
}: LiveStreamWidgetProps) {
  const { t } = useTranslation()
  const { push } = useSecondaryPage()
  const { hideWidgetTitles, unpinLiveStreamWidget } = useWidgets()
  const [isHovered, setIsHovered] = useState(false)
  const [isPlaying, setIsPlaying] = useState(true)
  const [isMuted, setIsMuted] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const sourceIdRef = useRef(`live-stream-widget-${widgetId}`)

  const playVideo = async (video: HTMLVideoElement) => {
    try {
      return await mediaManager.play(video)
    } catch {
      try {
        video.load()
        return await mediaManager.play(video)
      } catch {
        return false
      }
    }
  }

  const pauseVideo = (video: HTMLVideoElement) => {
    mediaManager.pause(video)
  }

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const synced = liveStreamSyncService.getState(streamingUrl)
    const nextMuted = synced?.isMuted ?? false
    const shouldPlay = synced?.isPlaying !== false

    video.muted = nextMuted
    setIsMuted(nextMuted)

    if (!shouldPlay) {
      pauseVideo(video)
      setIsPlaying(false)
      return
    }

    playVideo(video).then((played) => {
      setIsPlaying(played)
      liveStreamSyncService.setState(streamingUrl, {
        isPlaying: played,
        isMuted: nextMuted,
        activeSourceId: played ? sourceIdRef.current : undefined
      })
    })
  }, [streamingUrl])

  useEffect(() => {
    if (!streamingUrl) return

    const handleCommand = (event: Event) => {
      const customEvent = event as CustomEvent<TLiveStreamSyncCommand>
      const command = customEvent.detail

      if (!command || command.streamingUrl !== streamingUrl) return
      if (command.sourceId === sourceIdRef.current) return

      const video = videoRef.current
      if (!video) return

      if (command.action === 'play') {
        if (!video.paused) {
          pauseVideo(video)
        }
        return
      }
      if (command.action === 'pause') {
        pauseVideo(video)
        return
      }
      if (command.action === 'set-muted') {
        video.muted = !!command.muted
        setIsMuted(video.muted)
        liveStreamSyncService.setState(streamingUrl, { isMuted: video.muted })
      }
    }

    liveStreamSyncService.addEventListener('command', handleCommand as EventListener)
    return () => {
      liveStreamSyncService.removeEventListener('command', handleCommand as EventListener)
    }
  }, [streamingUrl])

  const handleTogglePlay = async () => {
    const video = videoRef.current
    if (!video) return

    try {
      if (video.paused) {
        const played = await playVideo(video)
        setIsPlaying(played)
        if (!played) return
        liveStreamSyncService.setState(streamingUrl, {
          isPlaying: true,
          activeSourceId: sourceIdRef.current
        })
        liveStreamSyncService.dispatchCommand({
          streamingUrl,
          action: 'play',
          sourceId: sourceIdRef.current
        })
      } else {
        pauseVideo(video)
        liveStreamSyncService.setState(streamingUrl, {
          isPlaying: false,
          activeSourceId: sourceIdRef.current
        })
        liveStreamSyncService.dispatchCommand({
          streamingUrl,
          action: 'pause',
          sourceId: sourceIdRef.current
        })
      }
    } catch {
      setIsPlaying(!video.paused)
    }
  }

  const handleToggleMute = () => {
    const video = videoRef.current
    if (!video) return
    video.muted = !video.muted
    setIsMuted(video.muted)
    liveStreamSyncService.setState(streamingUrl, { isMuted: video.muted })
    liveStreamSyncService.dispatchCommand({
      streamingUrl,
      action: 'set-muted',
      muted: video.muted,
      sourceId: sourceIdRef.current
    })
  }

  return (
    <WidgetContainer>
      {!hideWidgetTitles && (
        <CardHeader
          className="flex flex-row items-center justify-between space-y-0 p-4 pb-3 border-b group"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <CardTitle className="font-semibold flex items-center gap-2 min-w-0" style={{ fontSize: '14px' }}>
            <Radio className="h-4 w-4 text-red-500" />
            <span className="truncate">{title || t('Live Stream')}</span>
          </CardTitle>
          {isHovered && (
            <button
              className="shrink-0 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              onClick={() => unpinLiveStreamWidget(widgetId)}
              title={t('Unpin from sidebar')}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </CardHeader>
      )}

      <div className={`px-3 ${hideWidgetTitles ? 'pt-3' : ''} pb-3`}>
        <div className="relative overflow-hidden rounded-lg border bg-black">
          <button
            className="absolute right-2 top-2 z-10 rounded-full bg-black/60 p-1 text-white hover:bg-black/80 transition-colors"
            onClick={() => unpinLiveStreamWidget(widgetId)}
            title={t('Unpin from sidebar')}
          >
            <X className="h-3.5 w-3.5" />
          </button>

          {streamingUrl ? (
            <video
              ref={videoRef}
              src={streamingUrl}
              poster={image}
              autoPlay
              playsInline
              className="w-full aspect-video bg-black object-contain"
              onPlay={() => {
                void mediaManager.play(videoRef.current)
                setIsPlaying(true)
                liveStreamSyncService.setState(streamingUrl, {
                  isPlaying: true,
                  activeSourceId: sourceIdRef.current
                })
              }}
              onPause={() => {
                setIsPlaying(false)
                const sharedState = liveStreamSyncService.getState(streamingUrl)
                if (!sharedState?.activeSourceId || sharedState.activeSourceId === sourceIdRef.current) {
                  liveStreamSyncService.setState(streamingUrl, {
                    isPlaying: false,
                    activeSourceId: sourceIdRef.current
                  })
                }
              }}
              onVolumeChange={(event) => {
                setIsMuted(event.currentTarget.muted)
                liveStreamSyncService.setState(streamingUrl, { isMuted: event.currentTarget.muted })
              }}
            />
          ) : (
            <div className="flex aspect-video w-full items-center justify-center text-xs text-muted-foreground">
              {t('Stream source unavailable')}
            </div>
          )}

          <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-white/90 hover:text-white hover:bg-white/15"
                onClick={handleTogglePlay}
                title={isPlaying ? t('Pause') : t('Play')}
              >
                {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-white/90 hover:text-white hover:bg-white/15"
                onClick={handleToggleMute}
                title={isMuted ? t('Unmute') : t('Mute')}
              >
                {isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="ml-auto h-7 px-2 text-xs"
                onClick={() => push(`/live/${naddr}`)}
              >
                {t('Open Stream')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </WidgetContainer>
  )
}
