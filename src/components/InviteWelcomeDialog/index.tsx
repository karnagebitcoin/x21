import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import UserAvatar from '@/components/UserAvatar'
import Username from '@/components/Username'
import { useNostr } from '@/providers/NostrProvider'
import { useFetchProfile, useFetchFollowings } from '@/hooks'
import { useFollowList } from '@/providers/FollowListProvider'
import { toast } from 'sonner'
import { Users, UserPlus } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

interface InviteWelcomeDialogProps {
  open: boolean
  onClose: () => void
  inviterPubkey: string
}

export default function InviteWelcomeDialog({
  open,
  onClose,
  inviterPubkey
}: InviteWelcomeDialogProps) {
  const { t } = useTranslation()
  const { pubkey } = useNostr()
  const { profile: inviterProfile, isFetching: fetchingProfile } = useFetchProfile(inviterPubkey)
  const { followings: inviterFollowings } = useFetchFollowings(inviterPubkey)
  const { followMultiple } = useFollowList()
  const [followInviter, setFollowInviter] = useState(true)
  const [followInviterFollows, setFollowInviterFollows] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)

  // Filter out the current user from inviter's followings
  const filteredInviterFollowings = useMemo(() => {
    if (!pubkey) return inviterFollowings
    return inviterFollowings.filter((pk) => pk !== pubkey)
  }, [inviterFollowings, pubkey])

  const handleContinue = async () => {
    if (!pubkey || isProcessing) return

    setIsProcessing(true)
    try {
      const pubkeysToFollow: string[] = []

      if (followInviter) {
        pubkeysToFollow.push(inviterPubkey)
      }

      if (followInviterFollows) {
        pubkeysToFollow.push(...filteredInviterFollowings)
      }

      if (pubkeysToFollow.length > 0) {
        await followMultiple(pubkeysToFollow)

        const inviterName = inviterProfile?.original_username || inviterProfile?.username || 'your inviter'

        if (followInviter && followInviterFollows) {
          toast.success(
            t('You are now following {{name}} and {{count}} of their follows', {
              name: inviterName,
              count: filteredInviterFollowings.length
            })
          )
        } else if (followInviter) {
          toast.success(
            t('You are now following {{name}}', {
              name: inviterName
            })
          )
        } else if (followInviterFollows) {
          toast.success(
            t('You are now following {{count}} people', {
              count: filteredInviterFollowings.length
            })
          )
        }
      }

      onClose()
    } catch (error) {
      console.error('Failed to follow users:', error)
      toast.error(t('Failed to follow users. Please try again.'))
    } finally {
      setIsProcessing(false)
    }
  }

  if (!pubkey) return null

  // Get a proper display name for the inviter
  const inviterName = inviterProfile?.original_username || inviterProfile?.username || 'your inviter'

  return (
    <Dialog open={open} onOpenChange={(open) => !open && !isProcessing && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center space-y-2">
          <DialogTitle className="flex items-center justify-center gap-2 text-center">
            <UserPlus className="h-5 w-5" />
            {t('Welcome to x21!')}
          </DialogTitle>
          <DialogDescription className="text-center">
            {t('You joined through an invite link')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Inviter Profile */}
          <div className="flex flex-col items-center gap-3 p-4 rounded-2xl bg-muted/50">
            {fetchingProfile ? (
              <>
                <Skeleton className="h-16 w-16 rounded-full" />
                <div className="flex flex-col items-center space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </>
            ) : (
              <>
                <UserAvatar userId={inviterPubkey} size="big" />
                <div className="flex flex-col items-center text-center">
                  <div className="font-medium">
                    <Username userId={inviterPubkey} />
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {t('Your inviter')}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Follow Options */}
          <div className="space-y-3">
            {/* Follow Inviter */}
            <div className="flex items-start space-x-3 p-3 rounded-xl border">
              <Checkbox
                id="follow-inviter"
                checked={followInviter}
                onCheckedChange={(checked) => setFollowInviter(checked as boolean)}
              />
              <div className="flex-1 space-y-1">
                <Label
                  htmlFor="follow-inviter"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  {t('Follow {{name}}', {
                    name: inviterName
                  })}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t('Stay connected with the person who invited you')}
                </p>
              </div>
            </div>

            {/* Follow Inviter's Follows */}
            <div className="flex items-start space-x-3 p-3 rounded-xl border">
              <Checkbox
                id="follow-inviter-follows"
                checked={followInviterFollows}
                onCheckedChange={(checked) => setFollowInviterFollows(checked as boolean)}
              />
              <div className="flex-1 space-y-1">
                <Label
                  htmlFor="follow-inviter-follows"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  {t("Follow {{name}}'s follows", {
                    name: inviterName
                  })}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {filteredInviterFollowings.length > 0 ? (
                    <>
                      <Users className="inline h-3 w-3 mr-1" />
                      {t('Follow {{count}} people to get started', {
                        count: filteredInviterFollowings.length
                      })}
                    </>
                  ) : (
                    t('No follows to add')
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            onClick={handleContinue}
            disabled={isProcessing || (!followInviter && !followInviterFollows)}
            className="w-full rounded-xl"
          >
            {isProcessing ? t('Processing...') : t('Continue')}
          </Button>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isProcessing}
            className="w-full rounded-xl"
          >
            {t('Skip')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
