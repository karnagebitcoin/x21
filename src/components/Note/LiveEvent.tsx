import { Badge } from '@/components/ui/badge'
import { getLiveEventMetadataFromEvent } from '@/lib/event-metadata'
import { getLiveStreamNaddr, getLiveStreamTitle, getLiveStreamingUrl } from '@/lib/live-stream'
import { useContentPolicy } from '@/providers/ContentPolicyProvider'
import { usePrimaryPage } from '@/PageManager'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { Event } from 'nostr-tools'
import { Radio } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../ui/button'
import Image from '../Image'
import MediaPlayer from '../MediaPlayer'

export default function LiveEvent({ event, className }: { event: Event; className?: string }) {
  const { t } = useTranslation()
  const { isSmallScreen } = useScreenSize()
  const { navigate } = usePrimaryPage()
  const { autoLoadMedia } = useContentPolicy()
  const metadata = useMemo(() => getLiveEventMetadataFromEvent(event), [event])
  const streamingUrl = useMemo(() => getLiveStreamingUrl(event), [event])
  const naddr = useMemo(() => getLiveStreamNaddr(event), [event])

  const liveStatusComponent =
    metadata.status &&
    (metadata.status === 'live' ? (
      <Badge className="gap-1 bg-red-600 text-white hover:bg-red-600">
        <Radio className="size-3 animate-pulse" />
        {t('LIVE')}
      </Badge>
    ) : metadata.status === 'ended' ? (
      <Badge variant="destructive">ended</Badge>
    ) : (
      <Badge variant="secondary">{metadata.status}</Badge>
    ))

  const titleComponent = <div className="text-xl font-semibold line-clamp-1">{metadata.title}</div>

  const summaryComponent = metadata.summary && (
    <div className="text-sm text-muted-foreground line-clamp-4">{metadata.summary}</div>
  )

  const tagsComponent = metadata.tags.length > 0 && (
    <div className="flex gap-1 flex-wrap">
      {metadata.tags.map((tag) => (
        <Badge key={tag} variant="secondary">
          {tag}
        </Badge>
      ))}
    </div>
  )

  if (isSmallScreen) {
    return (
      <div className={className}>
        {streamingUrl ? (
          <MediaPlayer
            src={streamingUrl}
            className="aspect-video w-full overflow-hidden rounded-lg"
            mustLoad={autoLoadMedia}
          />
        ) : (
          metadata.image &&
          autoLoadMedia && (
            <Image
              image={{ url: metadata.image, pubkey: event.pubkey }}
              className="w-full aspect-video"
              hideIfError
            />
          )
        )}
        <div className="space-y-1">
          {titleComponent}
          {liveStatusComponent}
          {summaryComponent}
          {tagsComponent}
          {naddr && (
            <Button
              variant="secondary"
              className="mt-2 w-full rounded-full"
              onClick={(e) => {
                e.stopPropagation()
                navigate('livestreams', {
                  streamToOpen: {
                    naddr,
                    event,
                    title: getLiveStreamTitle(event, t('Live Stream')),
                    openedAt: Date.now()
                  }
                })
              }}
            >
              {t('Open stream')}
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      <div className="flex gap-4">
        <div className="w-full max-w-sm shrink-0">
          {streamingUrl ? (
            <MediaPlayer
              src={streamingUrl}
              className="aspect-video w-full overflow-hidden rounded-lg"
              mustLoad={autoLoadMedia}
            />
          ) : (
            metadata.image &&
            autoLoadMedia && (
              <Image
                image={{ url: metadata.image, pubkey: event.pubkey }}
                className="aspect-[4/3] xl:aspect-video bg-foreground h-44"
                hideIfError
              />
            )
          )}
        </div>
        <div className="flex-1 w-0 space-y-1">
          {titleComponent}
          {liveStatusComponent}
          {summaryComponent}
          {tagsComponent}
          {naddr && (
            <Button
              variant="secondary"
              className="mt-2 rounded-full"
              onClick={(e) => {
                e.stopPropagation()
                navigate('livestreams', {
                  streamToOpen: {
                    naddr,
                    event,
                    title: getLiveStreamTitle(event, t('Live Stream')),
                    openedAt: Date.now()
                  }
                })
              }}
            >
              {t('Open stream')}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
