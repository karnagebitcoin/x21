import { Badge } from '@/components/ui/badge'
import { useLiveStreamPresence } from '@/hooks/useLiveStreamPresence'
import { getLiveStreamTitle } from '@/lib/live-stream'
import { cn } from '@/lib/utils'
import { usePrimaryPage } from '@/PageManager'
import { Radio } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export default function LiveStreamPresenceBadge({
  pubkey,
  className
}: {
  pubkey: string
  className?: string
}) {
  const { t } = useTranslation()
  const { navigate } = usePrimaryPage()
  const { event, naddr, isLive } = useLiveStreamPresence(pubkey)

  if (!isLive || !event || !naddr) return null

  return (
    <button
      type="button"
      className={cn('shrink-0', className)}
      title={t('Open live stream')}
      aria-label={t('Open live stream')}
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
      <Badge className="gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[11px] text-white hover:bg-red-600">
        <Radio className="size-2.5 animate-pulse" />
        {t('LIVE')}
      </Badge>
    </button>
  )
}
