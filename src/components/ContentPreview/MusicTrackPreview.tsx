import { cn } from '@/lib/utils'
import { Event } from 'nostr-tools'
import { Music2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export default function MusicTrackPreview({
  event,
  className
}: {
  event: Event
  className?: string
}) {
  const { t } = useTranslation()
  const title = event.tags.find((tag) => tag[0] === 'title')?.[1] || t('Untitled Track')
  const artist = event.tags.find((tag) => tag[0] === 'artist')?.[1]

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <Music2 className="size-3 shrink-0" />
      <span className="truncate">
        {artist ? `${artist} - ${title}` : title}
      </span>
    </div>
  )
}
