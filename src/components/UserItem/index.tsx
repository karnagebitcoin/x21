import FollowButton from '@/components/FollowButton'
import Nip05 from '@/components/Nip05'
import UserAvatar from '@/components/UserAvatar'
import Username from '@/components/Username'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { TLastActivityData } from '@/hooks'
import { Clock, Info } from 'lucide-react'
import { useMemo } from 'react'

export default function UserItem({
  pubkey,
  hideFollowButton,
  className,
  compactFollowButton,
  activityData,
  showLastActivity
}: {
  pubkey: string
  hideFollowButton?: boolean
  className?: string
  compactFollowButton?: boolean
  activityData?: TLastActivityData
  showLastActivity?: boolean
}) {
  const activityText = useMemo(() => {
    if (!activityData || !showLastActivity) return null

    if (activityData.isLoading) {
      return 'Loading...'
    }

    if (activityData.daysSinceLastPost === null) {
      return 'No recent posts found'
    }

    const days = activityData.daysSinceLastPost

    if (days === 0) {
      return 'Active today'
    } else if (days === 1) {
      return 'Last post 1 day ago'
    } else if (days < 30) {
      return `Last post ${days} days ago`
    } else if (days < 365) {
      const months = Math.floor(days / 30)
      return months === 1 ? 'Last post 1 month ago' : `Last post ${months} months ago`
    } else {
      const years = Math.floor(days / 365)
      return years === 1 ? 'Last post 1 year ago' : `Last post ${years} years ago`
    }
  }, [activityData, showLastActivity])

  const isInactive = useMemo(() => {
    if (!activityData || !showLastActivity) return false
    return activityData.daysSinceLastPost === null || activityData.daysSinceLastPost >= 30
  }, [activityData, showLastActivity])

  return (
    <div className={cn('flex gap-2 items-center min-h-14 py-2', className)}>
      <UserAvatar userId={pubkey} className="shrink-0" />
      <div className="w-full overflow-hidden flex-1">
        <div className="flex items-center gap-2">
          <Username
            userId={pubkey}
            className="font-semibold truncate max-w-full w-fit"
            skeletonClassName="h-4"
          />
          {isInactive && showLastActivity && (
            <Badge variant="secondary" className="text-xs shrink-0">
              Inactive
            </Badge>
          )}
        </div>
        {showLastActivity && activityText ? (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
            <Clock className="h-3 w-3" />
            <span>{activityText}</span>
            {activityData?.daysSinceLastPost === null && (
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[250px]">
                    <p className="text-xs">
                      This user may post to relays you're not connected to, or they may truly be inactive.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        ) : (
          <Nip05 pubkey={pubkey} />
        )}
      </div>
      {!hideFollowButton && <FollowButton pubkey={pubkey} size={compactFollowButton ? 'sm' : 'default'} />}
    </div>
  )
}

export function UserItemSkeleton({ hideFollowButton }: { hideFollowButton?: boolean }) {
  return (
    <div className="flex gap-2 items-center h-14">
      <Skeleton className="w-10 h-10 rounded-full shrink-0" />
      <div className="w-full">
        <div className="py-1">
          <Skeleton className="w-16 h-4" />
        </div>
      </div>
      {!hideFollowButton && <Skeleton className="rounded-full min-w-28 h-9" />}
    </div>
  )
}
