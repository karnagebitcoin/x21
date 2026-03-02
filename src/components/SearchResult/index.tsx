import { BIG_RELAY_URLS, SEARCHABLE_RELAY_URLS } from '@/constants'
import { TSearchParams } from '@/types'
import NormalFeed from '../NormalFeed'
import Profile from '../Profile'
import { ProfileListBySearch } from '../ProfileListBySearch'
import Relay from '../Relay'
import TrendingNotes from '../TrendingNotes'

export default function SearchResult({
  searchParams,
  isInDeckView = false
}: {
  searchParams: TSearchParams | null
  isInDeckView?: boolean
}) {
  if (!searchParams) {
    return <TrendingNotes />
  }
  if (searchParams.type === 'profile') {
    return <Profile id={searchParams.search} isInDeckView={isInDeckView} />
  }
  if (searchParams.type === 'profiles') {
    return <ProfileListBySearch search={searchParams.search} />
  }
  if (searchParams.type === 'notes') {
    return (
      <NormalFeed
        subRequests={[{ urls: SEARCHABLE_RELAY_URLS, filter: { search: searchParams.search } }]}
        showRelayCloseReason
        isInDeckView={isInDeckView}
      />
    )
  }
  if (searchParams.type === 'hashtag') {
    return (
      <NormalFeed
        subRequests={[{ urls: BIG_RELAY_URLS, filter: { '#t': [searchParams.search] } }]}
        showRelayCloseReason
        isInDeckView={isInDeckView}
      />
    )
  }
  return <Relay url={searchParams.search} isInDeckView={isInDeckView} />
}
