import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import RelayHealthBadge from '@/components/RelayHealthBadge'
import RelayIcon from '@/components/RelayIcon'
import relayRecommendationsService, {
  TRelayRecommendation
} from '@/services/relay-recommendations.service'
import { useNostr } from '@/providers/NostrProvider'
import { Loader, Plus, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

type Props = {
  existingRelayUrls: string[]
  onAddRelay: (url: string) => void
  title?: string
  description?: string
  hideHeader?: boolean
}

export default function FollowsRelayRecommendations({
  existingRelayUrls,
  onAddRelay,
  title,
  description,
  hideHeader = false
}: Props) {
  const { t } = useTranslation()
  const { pubkey } = useNostr()
  const [recommendations, setRecommendations] = useState<TRelayRecommendation[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!pubkey) return

    const fetchRecommendations = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const recs = await relayRecommendationsService.getRecommendationsWithHealth(pubkey, 15)
        setRecommendations(recs)
      } catch (err) {
        console.error('Failed to fetch relay recommendations:', err)
        setError(t('Failed to load recommendations'))
      } finally {
        setIsLoading(false)
      }
    }

    fetchRecommendations()
  }, [pubkey, t])

  if (!pubkey) return null

  // Filter out relays the user already has
  const filteredRecommendations = recommendations.filter(
    (rec) => !existingRelayUrls.includes(rec.url)
  )

  // Only show top recommendations (Great or Good health, or high follower count)
  const topRecommendations = filteredRecommendations
    .filter((rec) => {
      // Always show if many followers use it
      if (rec.followerCount >= 5) return true
      // Otherwise only show if health is good
      const health = rec.health?.status
      return health === 'great' || health === 'good'
    })
    .slice(0, 8)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4 text-muted-foreground">
        <Loader className="w-4 h-4 animate-spin mr-2" />
        {t('Finding relays from your follows...')}
      </div>
    )
  }

  if (error) {
    return null
  }

  if (topRecommendations.length === 0) {
    return null
  }

  return (
    <div className="space-y-3">
      {!hideHeader && (
        <div className="flex items-center gap-2 font-semibold">
          <Users className="w-4 h-4" />
          <span>{title ?? t('Recommended from follows')}</span>
        </div>
      )}
      <p className="text-sm text-muted-foreground">
        {description ?? t('Not sure what to add? Try some relays from people you follow')}
      </p>
      <div className="space-y-2">
        {topRecommendations.map((rec) => (
          <RecommendationItem key={rec.url} recommendation={rec} onAdd={onAddRelay} />
        ))}
      </div>
    </div>
  )
}

function RecommendationItem({
  recommendation,
  onAdd
}: {
  recommendation: TRelayRecommendation
  onAdd: (url: string) => void
}) {
  const { t } = useTranslation()
  const followerCountLabel = t('n follows use this', { count: recommendation.followerCount })
  const usesThisLabel =
    followerCountLabel === 'n follows use this'
      ? `${recommendation.followerCount} ${recommendation.followerCount === 1 ? 'follow uses this' : 'follows use this'}`
      : followerCountLabel

  return (
    <div className="flex items-center justify-between gap-2 p-2 border rounded-lg bg-muted/30">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <RelayIcon url={recommendation.url} />
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate text-sm">{recommendation.url}</div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="text-xs text-muted-foreground flex items-center gap-1 cursor-help">
                  <Users className="w-3 h-3" />
                  <span>{usesThisLabel}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>{t('follows relay tooltip')}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <RelayHealthBadge url={recommendation.url} result={recommendation.health} />
        <Button size="sm" variant="secondary" onClick={() => onAdd(recommendation.url)}>
          <Plus className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}
