import { useSecondaryPage } from '@/PageManager'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Event } from 'nostr-tools'
import { useTranslation } from 'react-i18next'
import { Radio, Users, Calendar, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import UserAvatar from '@/components/UserAvatar'
import Username from '@/components/Username'
import { FormattedTimestamp } from '@/components/FormattedTimestamp'
import Image from '@/components/Image'
import { nip19 } from 'nostr-tools'
import { Button } from '@/components/ui/button'

export default function LiveEventCard({ event }: { event: Event }) {
  const { t } = useTranslation()
  const { push } = useSecondaryPage()

  const title = event.tags.find(t => t[0] === 'title')?.[1] || t('Untitled Live Stream')
  const summary = event.tags.find(t => t[0] === 'summary')?.[1]
  const image = event.tags.find(t => t[0] === 'image')?.[1]
  const streamingUrl = event.tags.find(t => t[0] === 'streaming')?.[1]
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

  const handleCardClick = () => {
    // If there's a streaming URL, we could navigate to a detail page
    // For now, just try to open the streaming URL if it exists
    if (streamingUrl) {
      window.open(streamingUrl, '_blank', 'noopener,noreferrer')
    } else {
      push(`/live/${naddr}`)
    }
  }

  const handleStreamClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (streamingUrl) {
      window.open(streamingUrl, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <Card
      className="overflow-hidden hover:shadow-lg transition-all cursor-pointer group"
      onClick={handleCardClick}
    >
      {image && (
        <div className="relative aspect-video overflow-hidden bg-muted">
          <Image
            src={image}
            alt={title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          <div className="absolute top-2 left-2">
            <Badge variant="destructive" className="bg-red-600 text-white flex items-center gap-1">
              <Radio className="w-3 h-3 animate-pulse" />
              {t('LIVE')}
            </Badge>
          </div>
          {currentParticipants && (
            <div className="absolute top-2 right-2">
              <Badge variant="secondary" className="bg-black/70 text-white flex items-center gap-1">
                <Users className="w-3 h-3" />
                {currentParticipants}
              </Badge>
            </div>
          )}
        </div>
      )}

      <div className="p-4 space-y-3">
        {!image && (
          <div className="flex items-center justify-between">
            <Badge variant="destructive" className="bg-red-600 text-white flex items-center gap-1 w-fit">
              <Radio className="w-3 h-3 animate-pulse" />
              {t('LIVE')}
            </Badge>
            {currentParticipants && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                {currentParticipants}
              </Badge>
            )}
          </div>
        )}

        <div className="flex items-start gap-3">
          <UserAvatar userId={event.pubkey} size="medium" className="shrink-0" />
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg line-clamp-2 group-hover:text-primary transition-colors">
              {title}
            </h3>
            <Username
              userId={event.pubkey}
              className="text-sm text-muted-foreground"
            />
          </div>
        </div>

        {summary && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {summary}
          </p>
        )}

        <div className="flex flex-wrap gap-3 items-center text-sm text-muted-foreground">
          {starts && (
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              <span>
                {t('Started')}{' '}
                <FormattedTimestamp timestamp={parseInt(starts)} short />
              </span>
            </div>
          )}

          {totalParticipants && (
            <div className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              <span>{totalParticipants} {t('total viewers')}</span>
            </div>
          )}
        </div>

        {hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {hashtags.slice(0, 5).map((tag, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                #{tag}
              </Badge>
            ))}
            {hashtags.length > 5 && (
              <Badge variant="secondary" className="text-xs">
                +{hashtags.length - 5}
              </Badge>
            )}
          </div>
        )}

        {streamingUrl && (
          <Button
            onClick={handleStreamClick}
            className="w-full"
            variant="default"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            {t('Watch Stream')}
          </Button>
        )}
      </div>
    </Card>
  )
}
