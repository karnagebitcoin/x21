import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { Skeleton } from '@/components/ui/skeleton'
import { useFetchProfile } from '@/hooks'
import { toProfile } from '@/lib/link'
import { generateImageByPubkey } from '@/lib/pubkey'
import { cn } from '@/lib/utils'
import { SecondaryPageLink } from '@/PageManager'
import { useMemo } from 'react'
import ProfileCard from '../ProfileCard'
import { useTextOnlyMode } from '@/providers/TextOnlyModeProvider'
import { useDisableAvatarAnimations } from '@/providers/DisableAvatarAnimationsProvider'

const UserAvatarSizeCnMap = {
  xl: 'w-32 h-32',
  large: 'w-24 h-24',
  big: 'w-16 h-16',
  semiBig: 'w-12 h-12',
  normal: 'w-10 h-10',
  medium: 'w-9 h-9',
  compact: 'w-8 h-8',
  small: 'w-7 h-7',
  xSmall: 'w-5 h-5',
  tiny: 'w-4 h-4'
}

// Helper to check if a URL is a GIF
function isGifUrl(url: string): boolean {
  try {
    const urlObj = new URL(url)
    return urlObj.pathname.toLowerCase().endsWith('.gif')
  } catch {
    return url.toLowerCase().includes('.gif')
  }
}

// Helper to get a static version of an avatar
function getStaticAvatar(avatarUrl: string | undefined, disableAnimations: boolean): string | undefined {
  if (!disableAnimations || !avatarUrl || !isGifUrl(avatarUrl)) {
    return avatarUrl
  }

  // For nostr.build, we can add ?aspect=1:1 or similar parameters
  // For now, we'll use a simple approach: show the fallback avatar for GIFs
  // This ensures no animation while still showing something
  return undefined
}

export default function UserAvatar({
  userId,
  className,
  size = 'normal',
  noLink = false
}: {
  userId: string
  className?: string
  size?: 'xl' | 'large' | 'big' | 'semiBig' | 'normal' | 'medium' | 'compact' | 'small' | 'xSmall' | 'tiny'
  noLink?: boolean
}) {
  const { textOnlyMode } = useTextOnlyMode()
  const { disableAvatarAnimations } = useDisableAvatarAnimations()
  const { profile } = useFetchProfile(userId)
  const defaultAvatar = useMemo(
    () => (profile?.pubkey ? generateImageByPubkey(profile.pubkey) : ''),
    [profile]
  )

  // In text-only mode, don't render avatar at all
  if (textOnlyMode) {
    return null
  }

  if (!profile) {
    return (
      <Skeleton className={cn('shrink-0', UserAvatarSizeCnMap[size], 'rounded-full', className)} />
    )
  }
  const { avatar, pubkey } = profile

  const effectiveAvatar = getStaticAvatar(avatar, disableAvatarAnimations)

  const avatarElement = (
    <Avatar className={cn('shrink-0', UserAvatarSizeCnMap[size], className)}>
      <AvatarImage src={effectiveAvatar} className="object-cover object-center" />
      <AvatarFallback>
        <img src={defaultAvatar} alt={pubkey} />
      </AvatarFallback>
    </Avatar>
  )

  if (noLink) {
    return (
      <HoverCard>
        <HoverCardTrigger>
          {avatarElement}
        </HoverCardTrigger>
        <HoverCardContent className="w-72">
          <ProfileCard pubkey={pubkey} />
        </HoverCardContent>
      </HoverCard>
    )
  }

  return (
    <HoverCard>
      <HoverCardTrigger>
        <SecondaryPageLink to={toProfile(pubkey)} onClick={(e) => e.stopPropagation()}>
          {avatarElement}
        </SecondaryPageLink>
      </HoverCardTrigger>
      <HoverCardContent className="w-72">
        <ProfileCard pubkey={pubkey} />
      </HoverCardContent>
    </HoverCard>
  )
}

export function SimpleUserAvatar({
  userId,
  size = 'normal',
  className,
  onClick
}: {
  userId: string
  size?: 'xl' | 'large' | 'big' | 'normal' | 'medium' | 'compact' | 'small' | 'xSmall' | 'tiny'
  className?: string
  onClick?: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void
}) {
  const { textOnlyMode } = useTextOnlyMode()
  const { disableAvatarAnimations } = useDisableAvatarAnimations()
  const { profile } = useFetchProfile(userId)
  const defaultAvatar = useMemo(
    () => (profile?.pubkey ? generateImageByPubkey(profile.pubkey) : ''),
    [profile]
  )

  // In text-only mode, don't render avatar at all
  if (textOnlyMode) {
    return null
  }

  if (!profile) {
    return (
      <Skeleton className={cn('shrink-0', UserAvatarSizeCnMap[size], 'rounded-full', className)} />
    )
  }
  const { avatar, pubkey } = profile

  const effectiveAvatar = getStaticAvatar(avatar, disableAvatarAnimations)

  return (
    <Avatar className={cn('shrink-0', UserAvatarSizeCnMap[size], className)} onClick={onClick}>
      <AvatarImage src={effectiveAvatar} className="object-cover object-center" />
      <AvatarFallback>
        <img src={defaultAvatar} alt={pubkey} />
      </AvatarFallback>
    </Avatar>
  )
}
