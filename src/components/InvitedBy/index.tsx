import { useFetchProfile } from '@/hooks'
import UserAvatar from '@/components/UserAvatar'
import Username from '@/components/Username'
import { SecondaryPageLink } from '@/PageManager'
import { toProfile } from '@/lib/link'
import { userIdToPubkey } from '@/lib/pubkey'
import { useTranslation } from 'react-i18next'
import { Calendar } from 'lucide-react'
import { useMemo } from 'react'

interface InvitedByProps {
  pubkey: string
}

export default function InvitedBy({ pubkey }: InvitedByProps) {
  const { t } = useTranslation()
  const { profile, isFetching } = useFetchProfile(pubkey)

  // Extract join info from profile metadata
  const joinInfo = useMemo(() => {
    if (!profile) return null

    const joinedThrough = profile.joined_through
    const joinedAt = profile.joined_at

    // Return null if neither field is present
    if (!joinedThrough && !joinedAt) return null

    // Convert inviter ID to pubkey (handles npub, nprofile, or hex)
    const inviterPubkey = joinedThrough ? userIdToPubkey(joinedThrough) : null

    return {
      inviterPubkey,
      joinedAt: joinedAt
    }
  }, [profile])

  if (isFetching || !joinInfo) {
    return null
  }

  const { inviterPubkey, joinedAt } = joinInfo

  // Format join date
  const joinDate = joinedAt ? new Date(joinedAt * 1000).toLocaleDateString() : null

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1 flex-wrap">
      {/* Joined on date - comes first */}
      {joinDate && (
        <>
          <Calendar className="h-4 w-4 shrink-0" />
          <span>{t('Joined on')} {joinDate}</span>
        </>
      )}

      {/* Joined through - comes after, on same line */}
      {inviterPubkey && joinDate && (
        <span className="text-muted-foreground">•</span>
      )}

      {inviterPubkey && (
        <div className="flex items-center gap-2">
          <span>{t('Joined through')}</span>
          <SecondaryPageLink
            to={toProfile(inviterPubkey)}
            className="flex items-center gap-1.5 hover:text-foreground transition-colors"
          >
            <UserAvatar userId={inviterPubkey} size="xSmall" />
            <Username userId={inviterPubkey} />
          </SecondaryPageLink>
        </div>
      )}
    </div>
  )
}
