import ProfileList from '@/components/ProfileList'
import SearchInput from '@/components/SearchInput'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { useFetchFollowings, useFetchProfile, useFetchLastActivity } from '@/hooks'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { useFollowList } from '@/providers/FollowListProvider'
import { useNostr } from '@/providers/NostrProvider'
import { Loader, UserPlus, UserMinus, Filter } from 'lucide-react'
import { forwardRef, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

type InactivityFilter = 'all' | '30' | '60' | '90' | '180' | '365'

const FollowingListPage = forwardRef(({ id, index }: { id?: string; index?: number }, ref) => {
  const { t } = useTranslation()
  const { pubkey: accountPubkey, checkLogin, publish, updateFollowListEvent } = useNostr()
  const { profile } = useFetchProfile(id)
  const { followings: myFollowings, followMultiple } = useFollowList()

  // Determine the target pubkey (either from id param or current user)
  const targetPubkey = useMemo(() => {
    if (id) {
      return profile?.pubkey
    }
    return accountPubkey
  }, [id, profile?.pubkey, accountPubkey])

  // Fetch followings for the target pubkey
  const { followings: theirFollowings } = useFetchFollowings(targetPubkey)

  const [searchQuery, setSearchQuery] = useState('')
  const [isFollowingAll, setIsFollowingAll] = useState(false)
  const [inactivityFilter, setInactivityFilter] = useState<InactivityFilter>('all')
  const [isUnfollowingInactive, setIsUnfollowingInactive] = useState(false)

  // Check if viewing someone else's following list
  const isViewingOthers = useMemo(() => {
    return targetPubkey && accountPubkey && targetPubkey !== accountPubkey
  }, [targetPubkey, accountPubkey])

  // Determine which list to use (viewing own list or someone else's)
  const displayFollowings = useMemo(() => {
    // When viewing own list (no id param), use myFollowings from FollowListProvider
    // When viewing others' list, use theirFollowings from fetch
    if (!id && accountPubkey) {
      return myFollowings
    }
    return theirFollowings
  }, [id, accountPubkey, myFollowings, theirFollowings])

  // Only fetch activity data when filter is not 'all'
  const shouldFetchActivity = inactivityFilter !== 'all'
  const { activityMap, isLoading: isLoadingActivity } = useFetchLastActivity(
    displayFollowings,
    shouldFetchActivity
  )

  // Filter users based on inactivity
  const filteredFollowings = useMemo(() => {
    if (inactivityFilter === 'all') {
      return displayFollowings
    }

    if (!shouldFetchActivity || activityMap.size === 0) {
      return displayFollowings
    }

    const daysThreshold = parseInt(inactivityFilter)

    return displayFollowings.filter(pubkey => {
      const activity = activityMap.get(pubkey)

      // Keep showing users while their data is loading to avoid flickering
      if (!activity || activity.isLoading) {
        return true // Changed: show while loading instead of hiding
      }

      // If no posts found, consider them inactive
      if (activity.daysSinceLastPost === null) {
        return true
      }

      return activity.daysSinceLastPost >= daysThreshold
    })
  }, [displayFollowings, inactivityFilter, activityMap, shouldFetchActivity])

  // Filter out already followed users (for viewing others' lists)
  const unfollowedUsers = useMemo(() => {
    if (!isViewingOthers) return []
    return theirFollowings.filter(pubkey => !myFollowings.includes(pubkey))
  }, [theirFollowings, myFollowings, isViewingOthers])

  const handleFollowAll = async () => {
    checkLogin(async () => {
      if (unfollowedUsers.length === 0) {
        toast.info(t('You are already following everyone in this list'))
        return
      }

      setIsFollowingAll(true)
      try {
        await followMultiple(unfollowedUsers)
        toast.success(t('Successfully followed {{count}} users', { count: unfollowedUsers.length }))
      } catch (error) {
        toast.error(t('Follow all failed') + ': ' + (error as Error).message)
      } finally {
        setIsFollowingAll(false)
      }
    })
  }

  const handleUnfollowInactive = async () => {
    checkLogin(async () => {
      if (filteredFollowings.length === 0) {
        toast.info(t('No inactive users to unfollow'))
        return
      }

      const confirmed = confirm(
        t('Are you sure you want to unfollow {{count}} inactive users?', {
          count: filteredFollowings.length
        })
      )

      if (!confirmed) return

      setIsUnfollowingInactive(true)
      try {
        // Fetch current follow list
        const clientService = (await import('@/services/client.service')).default
        const followListEvent = await clientService.fetchFollowListEvent(accountPubkey!)

        if (!followListEvent) {
          toast.error(t('Could not fetch follow list'))
          return
        }

        // Create new follow list without the inactive users
        const { createFollowListDraftEvent } = await import('@/lib/draft-event')

        const newTags = followListEvent.tags.filter(
          ([tagName, tagValue]) =>
            tagName !== 'p' || !filteredFollowings.includes(tagValue)
        )

        const newFollowListDraftEvent = createFollowListDraftEvent(
          newTags,
          followListEvent.content
        )
        const newFollowListEvent = await publish(newFollowListDraftEvent)
        await updateFollowListEvent(newFollowListEvent)

        toast.success(
          t('Successfully unfollowed {{count}} inactive users', {
            count: filteredFollowings.length
          })
        )

        // Reset filter after unfollowing
        setInactivityFilter('all')
      } catch (error) {
        toast.error(t('Unfollow failed') + ': ' + (error as Error).message)
      } finally {
        setIsUnfollowingInactive(false)
      }
    })
  }

  return (
    <SecondaryPageLayout
      ref={ref}
      index={index}
      title={
        id && profile?.username
          ? t("username's following", { username: profile.username })
          : t('Following')
      }
      displayScrollToTopButton
    >
      <div className="px-4 pt-2 pb-3 sticky top-0 bg-background z-10 space-y-2">
        <div className="flex gap-2">
          <SearchInput
            placeholder={t('Search following...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {isViewingOthers && unfollowedUsers.length > 0 && (
            <Button
              onClick={handleFollowAll}
              disabled={isFollowingAll}
              variant="default"
              className="shrink-0"
            >
              {isFollowingAll ? (
                <Loader className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="mr-2 h-4 w-4" />
              )}
              {isFollowingAll
                ? t('Following all...')
                : t('Follow All ({{count}})', { count: unfollowedUsers.length })}
            </Button>
          )}
        </div>

        {!isViewingOthers && (
          <div className="flex gap-2 items-center">
            <div className="flex items-center gap-2 flex-1">
              <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
              <Select
                value={inactivityFilter}
                onValueChange={(value) => setInactivityFilter(value as InactivityFilter)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('Filter by activity')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('All Users')}</SelectItem>
                  <SelectItem value="30">{t('Inactive 30+ days')}</SelectItem>
                  <SelectItem value="60">{t('Inactive 60+ days')}</SelectItem>
                  <SelectItem value="90">{t('Inactive 90+ days')}</SelectItem>
                  <SelectItem value="180">{t('Inactive 6+ months')}</SelectItem>
                  <SelectItem value="365">{t('Inactive 1+ year')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {inactivityFilter !== 'all' && filteredFollowings.length > 0 && (
              <Button
                onClick={handleUnfollowInactive}
                disabled={isUnfollowingInactive || isLoadingActivity}
                variant="destructive"
                className="shrink-0"
              >
                {isUnfollowingInactive ? (
                  <Loader className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <UserMinus className="mr-2 h-4 w-4" />
                )}
                {isUnfollowingInactive
                  ? t('Unfollowing...')
                  : t('Unfollow All ({{count}})', { count: filteredFollowings.length })}
              </Button>
            )}
          </div>
        )}

        {inactivityFilter !== 'all' && isLoadingActivity && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader className="h-4 w-4 animate-spin" />
            <span>{t('Loading activity data...')}</span>
          </div>
        )}

        {inactivityFilter !== 'all' && !isLoadingActivity && filteredFollowings.length > 0 && (
          <div className="text-xs text-muted-foreground p-2 bg-muted/50 rounded-md">
            <p>
              {t('Note: Users shown may post to relays you\'re not connected to. "No recent posts found" doesn\'t always mean inactive.')}
            </p>
          </div>
        )}
      </div>

      <ProfileList
        pubkeys={filteredFollowings}
        searchQuery={searchQuery}
        activityMap={shouldFetchActivity ? activityMap : undefined}
        showLastActivity={inactivityFilter !== 'all'}
      />
    </SecondaryPageLayout>
  )
})
FollowingListPage.displayName = 'FollowingListPage'
export default FollowingListPage
