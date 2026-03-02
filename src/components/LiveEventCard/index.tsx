import { useSecondaryPage } from '@/PageManager'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Event } from 'nostr-tools'
import { useTranslation } from 'react-i18next'
import { Radio, Users, Calendar } from 'lucide-react'
import UserAvatar from '@/components/UserAvatar'
import Username from '@/components/Username'
import { FormattedTimestamp } from '@/components/FormattedTimestamp'
import Image from '@/components/Image'
import { nip19 } from 'nostr-tools'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export default function LiveEventCard({
  event,
  onOpenStream
}: {
  event: Event
  onOpenStream?: (naddr: string, event: Event) => void
}) {
  const { t } = useTranslation()
  const { push } = useSecondaryPage()

  const title = event.tags.find(t => t[0] === 'title')?.[1] || t('Untitled Live Stream')
  const summary = event.tags.find(t => t[0] === 'summary')?.[1]
  const image = event.tags.find(t => t[0] === 'image')?.[1]
  const currentParticipants = event.tags.find(t => t[0] === 'current_participants')?.[1]
  const totalParticipants = event.tags.find(t => t[0] === 'total_participants')?.[1]
  const starts = event.tags.find(t => t[0] === 'starts')?.[1]
  const dTag = event.tags.find(t => t[0] === 'd')?.[1] || ''
  const hashtags = event.tags.filter(t => t[0] === 't').map(t => t[1])
  
  // Get relay hints from the event's relays tag
  const relays = event.tags.find(t => t[0] === 'relays')?.slice(1) || []

  // Create naddr for the live event (NIP-19)
  const naddr = nip19.naddrEncode({
    kind: 30311,
    pubkey: event.pubkey,
    identifier: dTag,
    relays: relays.length > 0 ? relays : ['wss://relay.damus.io']
  })

  const handleOpenStream = () => {
    if (onOpenStream) {
      onOpenStream(naddr, event)
      return
    }
    push(`/live/${naddr}`)
  }

  const handleStreamClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    handleOpenStream()
  }

  return (
    <Card
      className="overflow-hidden hover:shadow-lg transition-all cursor-pointer group"
      onClick={handleOpenStream}
    >
      {image && (
        <div className="relative aspect-[16/7] overflow-hidden bg-muted">
          <Image
            image={{ url: image, pubkey: event.pubkey }}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          <div className="absolute top-2 left-2">
            <Badge variant="destructive" className="bg-red-600 text-white flex items-center gap-1 text-[11px] px-2 py-0.5">
              <Radio className="w-2.5 h-2.5 animate-pulse" />
              {t('LIVE')}
            </Badge>
          </div>
          {currentParticipants && (
            <div className="absolute top-2 right-2">
              <Badge variant="secondary" className="bg-black/70 text-white flex items-center gap-1 text-[11px] px-2 py-0.5">
                <Users className="w-2.5 h-2.5" />
                {currentParticipants}
              </Badge>
            </div>
          )}
        </div>
      )}

      <div className="p-3 space-y-2">
        {!image && (
          <div className="flex items-center justify-between">
            <Badge variant="destructive" className="bg-red-600 text-white flex items-center gap-1 w-fit text-[11px] px-2 py-0.5">
              <Radio className="w-2.5 h-2.5 animate-pulse" />
              {t('LIVE')}
            </Badge>
            {currentParticipants && (
              <Badge variant="secondary" className="flex items-center gap-1 text-[11px] px-2 py-0.5">
                <Users className="w-2.5 h-2.5" />
                {currentParticipants}
              </Badge>
            )}
          </div>
        )}

        <div className="flex items-start gap-2.5">
          <UserAvatar userId={event.pubkey} size="small" className="shrink-0" />
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base leading-tight line-clamp-1 group-hover:text-primary transition-colors">
              {title}
            </h3>
            <Username
              userId={event.pubkey}
              className="text-xs text-muted-foreground"
            />
          </div>
        </div>

        {summary && (
          <p className="text-xs text-muted-foreground line-clamp-1">
            {summary}
          </p>
        )}

        <div className="flex flex-wrap gap-2 items-center text-xs text-muted-foreground">
          {starts && (
            <div className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>
                {t('Started')}{' '}
                <FormattedTimestamp timestamp={parseInt(starts)} short />
              </span>
            </div>
          )}

          {totalParticipants && (
            <div className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              <span>{totalParticipants} {t('total viewers')}</span>
            </div>
          )}
        </div>

        {hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {hashtags.slice(0, 3).map((tag, i) => (
              <Badge key={i} variant="secondary" className="text-[11px] px-1.5 py-0">
                #{tag}
              </Badge>
            ))}
            {hashtags.length > 3 && (
              <Badge variant="secondary" className="text-[11px] px-1.5 py-0">
                +{hashtags.length - 3}
              </Badge>
            )}
          </div>
        )}

        <Button onClick={handleStreamClick} className="w-full h-8 text-xs" variant="default">
          {t('Watch Stream')}
        </Button>
      </div>
    </Card>
  )
}

export function LiveEventCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <div className="relative aspect-[16/7] overflow-hidden bg-muted">
        <Skeleton className="h-full w-full rounded-none" />
        <Skeleton className="absolute top-2 left-2 h-5 w-14 rounded-md" />
        <Skeleton className="absolute top-2 right-2 h-5 w-12 rounded-md" />
      </div>

      <div className="p-3 space-y-2">
        <div className="flex items-start gap-2.5">
          <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
          <div className="flex-1 min-w-0 space-y-2">
            <Skeleton className="h-5 w-4/5" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>

        <Skeleton className="h-3 w-3/4" />

        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-3 w-24" />
        </div>

        <div className="flex gap-1">
          <Skeleton className="h-4 w-12 rounded-full" />
          <Skeleton className="h-4 w-16 rounded-full" />
          <Skeleton className="h-4 w-10 rounded-full" />
        </div>

        <Skeleton className="h-8 w-full rounded-md" />
      </div>
    </Card>
  )
}
