import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getLiveEventMetadataFromEvent } from '@/lib/event-metadata'
import { getLiveStreamNaddr, getLiveStreamTitle, getLiveStreamingUrl } from '@/lib/live-stream'
import { cn } from '@/lib/utils'
import { usePrimaryPage } from '@/PageManager'
import { Event } from 'nostr-tools'
import { Radio } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import Image from '../Image'
import MediaPlayer from '../MediaPlayer'
import UserAvatar from '../UserAvatar'
import Username from '../Username'

export function EmbeddedLiveStream({
  event,
  noteId,
  className
}: {
  event: Event
  noteId: string
  className?: string
}) {
  const { t } = useTranslation()
  const { navigate } = usePrimaryPage()
  const metadata = useMemo(() => getLiveEventMetadataFromEvent(event), [event])
  const streamingUrl = useMemo(() => getLiveStreamingUrl(event), [event])
  const naddr = useMemo(() => {
    if (noteId.startsWith('naddr1')) return noteId
    return getLiveStreamNaddr(event)
  }, [event, noteId])

  return (
    <div
      className={cn('space-y-3 rounded-lg border p-2 text-left sm:p-3', className)}
      onClick={(e) => e.stopPropagation()}
    >
      {streamingUrl ? (
        <MediaPlayer
          src={streamingUrl}
          className="aspect-video w-full overflow-hidden rounded-lg"
          mustLoad
        />
      ) : metadata.image ? (
        <Image
          image={{ url: metadata.image, pubkey: event.pubkey }}
          className="aspect-video w-full rounded-lg bg-muted"
          hideIfError
        />
      ) : null}

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-2">
            <Badge className="gap-1 rounded-full bg-red-600 text-white hover:bg-red-600">
              <Radio className="size-3 animate-pulse" />
              {t('LIVE')}
            </Badge>
          </div>
          <div className="mb-2 flex items-center gap-2">
            <UserAvatar userId={event.pubkey} size="small" />
            <Username userId={event.pubkey} className="truncate text-sm font-medium" />
          </div>
          <div className="line-clamp-1 text-base font-semibold">
            {metadata.title || getLiveStreamTitle(event, t('Untitled Live Stream'))}
          </div>
          {metadata.summary && (
            <div className="mt-1 line-clamp-2 text-sm text-muted-foreground">{metadata.summary}</div>
          )}
        </div>

        {naddr && (
          <Button
            variant="secondary"
            size="sm"
            className="shrink-0 rounded-full"
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
