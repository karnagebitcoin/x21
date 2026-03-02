import { useEffect, useState, useMemo } from 'react'
import { Event } from 'nostr-tools'
import client from '@/services/client.service'
import { BIG_RELAY_URLS, ExtendedKind } from '@/constants'
import { useFavoriteRelays } from '@/providers/FavoriteRelaysProvider'

/**
 * Hook to fetch invite information for a user
 * Returns the invite acceptance event if the user was invited by someone
 */
export function useFetchInviteInfo(pubkey?: string) {
  const { favoriteRelays } = useFavoriteRelays()
  const [inviteEvent, setInviteEvent] = useState<Event | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const inviteKind =
    (ExtendedKind as unknown as Record<string, number>).INVITE_ACCEPTANCE ??
    ExtendedKind.STARTER_PACK

  const relayUrls = useMemo(() => {
    return favoriteRelays.length > 0 ? favoriteRelays : BIG_RELAY_URLS
  }, [favoriteRelays])

  useEffect(() => {
    if (!pubkey) {
      setIsLoading(false)
      return
    }

    const fetchInvite = async () => {
      setIsLoading(true)
      try {
        console.log('[useFetchInviteInfo]', Date.now(), 'Fetching invite info for pubkey:', pubkey)
        console.log('[useFetchInviteInfo]', Date.now(), 'Searching kind:', inviteKind)
        console.log('[useFetchInviteInfo]', Date.now(), 'Using relays:', relayUrls)

        const events = await client.fetchEvents(
          relayUrls,
          {
            kinds: [inviteKind],
            authors: [pubkey],
            limit: 1
          }
        )

        console.log('[useFetchInviteInfo]', Date.now(), 'Found events:', events.length, events)

        if (events.length > 0) {
          console.log('[useFetchInviteInfo]', Date.now(), 'Setting inviteEvent to:', events[0])
          setInviteEvent(events[0])
        } else {
          console.log('[useFetchInviteInfo]', Date.now(), 'No events found, setting to null')
          setInviteEvent(null)
        }
      } catch (error) {
        console.error('[useFetchInviteInfo]', Date.now(), 'Failed to fetch invite info:', error)
        setInviteEvent(null)
      } finally {
        console.log('[useFetchInviteInfo]', Date.now(), 'Setting isLoading to false')
        setIsLoading(false)
      }
    }

    fetchInvite()
  }, [pubkey, relayUrls, inviteKind])

  const returnValue = { inviteEvent, isLoading }
  console.log('[useFetchInviteInfo]', Date.now(), 'Returning:', returnValue)
  return returnValue
}
