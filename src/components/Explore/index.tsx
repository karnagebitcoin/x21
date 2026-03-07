import FollowingFavoriteRelayList from '@/components/FollowingFavoriteRelayList'
import RelayPulse from '@/components/Explore/RelayPulse'
import Tabs from '@/components/Tabs'
import { useFetchRelayInfo } from '@/hooks'
import { toRelay } from '@/lib/link'
import { useSecondaryPage } from '@/PageManager'
import { useLowBandwidthMode } from '@/providers/LowBandwidthModeProvider'
import { useNostr } from '@/providers/NostrProvider'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import relayInfoService from '@/services/relay-info.service'
import client from '@/services/client.service'
import { TAwesomeRelayCollection } from '@/types'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import RelaySimpleInfo, { RelaySimpleInfoSkeleton } from '../RelaySimpleInfo'
import TrendingNotes from '../TrendingNotes'

type TExploreTab = 'trending' | 'global-communities' | 'followed-favorites'
type TFavoriteRelayEntry = [string, string[]]
type TPulseTarget = 'global-feeds' | 'communities' | 'followed-favorites'

const GLOBAL_COLLECTION_IDS = new Set(['featured', 'global'])

export default function Explore({ isInDeckView = false }: { isInDeckView?: boolean } = {}) {
  const { t } = useTranslation()
  const { pubkey } = useNostr()
  const { isSmallScreen } = useScreenSize()
  const { lowBandwidthMode } = useLowBandwidthMode()
  const [tab, setTab] = useState<TExploreTab>('trending')
  const [pendingPulseTarget, setPendingPulseTarget] = useState<TPulseTarget | null>(null)
  const [collections, setCollections] = useState<TAwesomeRelayCollection[] | null>(null)
  const [favoriteRelays, setFavoriteRelays] = useState<TFavoriteRelayEntry[]>([])
  const [favoritesLoading, setFavoritesLoading] = useState(false)

  useEffect(() => {
    relayInfoService.getAwesomeRelayCollections().then(setCollections)
  }, [])

  useEffect(() => {
    if (!pubkey) {
      setFavoriteRelays([])
      setFavoritesLoading(false)
      return
    }

    setFavoritesLoading(true)
    client
      .fetchFollowingFavoriteRelays(pubkey)
      .then((relays) => setFavoriteRelays(relays ?? []))
      .finally(() => setFavoritesLoading(false))
  }, [pubkey])

  const { globalCollections, communityCollections } = useMemo(() => {
    const allCollections = collections ?? []
    return {
      globalCollections: allCollections.filter((collection) => GLOBAL_COLLECTION_IDS.has(collection.id)),
      communityCollections: allCollections.filter((collection) => !GLOBAL_COLLECTION_IDS.has(collection.id))
    }
  }, [collections])

  const globalRelayCount = useMemo(
    () => new Set(globalCollections.flatMap((collection) => collection.relays)).size,
    [globalCollections]
  )
  const communityRelayCount = useMemo(
    () => new Set(communityCollections.flatMap((collection) => collection.relays)).size,
    [communityCollections]
  )
  const favoriteRelayCount = useMemo(
    () => new Set(favoriteRelays.map(([url]) => url)).size,
    [favoriteRelays]
  )
  const favoriteProfileCount = useMemo(
    () => new Set(favoriteRelays.flatMap(([, users]) => users)).size,
    [favoriteRelays]
  )
  const totalRelayCount = useMemo(
    () =>
      new Set([
        ...globalCollections.flatMap((collection) => collection.relays),
        ...communityCollections.flatMap((collection) => collection.relays),
        ...favoriteRelays.map(([url]) => url)
      ]).size,
    [communityCollections, favoriteRelays, globalCollections]
  )

  useEffect(() => {
    if (!pendingPulseTarget) return

    if (pendingPulseTarget === 'followed-favorites') {
      if (tab !== 'followed-favorites') return
      setPendingPulseTarget(null)
      return
    }

    if (tab !== 'global-communities') return

    const elementId =
      pendingPulseTarget === 'global-feeds' ? 'explore-global-feeds' : 'explore-communities'

    const scrollToTarget = () => {
      const element = document.getElementById(elementId)
      if (!element) return false
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return true
    }

    if (scrollToTarget()) {
      setPendingPulseTarget(null)
      return
    }

    const timeout = window.setTimeout(() => {
      if (scrollToTarget()) {
        setPendingPulseTarget(null)
      }
    }, 80)

    return () => window.clearTimeout(timeout)
  }, [pendingPulseTarget, tab])

  const handlePulseLaneClick = (target: TPulseTarget) => {
    setPendingPulseTarget(target)
    if (target === 'followed-favorites') {
      setTab('followed-favorites')
      return
    }
    setTab('global-communities')
  }

  return (
    <div className="pb-4">
      {!isSmallScreen && !lowBandwidthMode && totalRelayCount > 0 && (
        <div className="px-4 pt-4">
          <RelayPulse
            totalRelayCount={totalRelayCount}
            globalRelayCount={globalRelayCount}
            globalCollectionCount={globalCollections.length}
            communityRelayCount={communityRelayCount}
            communityCollectionCount={communityCollections.length}
            favoriteRelayCount={favoriteRelayCount}
            favoriteProfileCount={favoriteProfileCount}
            onLaneClick={handlePulseLaneClick}
          />
        </div>
      )}

      <Tabs
        value={tab}
        tabs={[
          { value: 'trending', label: 'Trending' },
          { value: 'global-communities', label: 'Global & Communities' },
          { value: 'followed-favorites', label: 'Followed Favorites' }
        ]}
        onTabChange={(nextTab) => setTab(nextTab as TExploreTab)}
        isInDeckView={isInDeckView}
      />

      {tab === 'trending' && <TrendingNotes showHeader={false} />}
      {tab === 'global-communities' && (
        <div className="space-y-8 px-4 pt-4">
          <CollectionGroup
            id="explore-global-feeds"
            title={t('Global feeds')}
            description="Widely-used relays and major public feeds across Nostr."
            collections={globalCollections}
          />
          <CollectionGroup
            id="explore-communities"
            title={t('Communities')}
            description="Interest-driven, language-focused, and curated community relays."
            collections={communityCollections}
          />
        </div>
      )}
      {tab === 'followed-favorites' && (
        <div className="pt-4">
          <div className="px-4 pb-3">
            <h2 className="text-lg font-semibold">{t('Followed Favorites')}</h2>
            <p className="text-sm text-muted-foreground">
              Relays that people you follow have explicitly saved as favorites.
            </p>
          </div>
          <FollowingFavoriteRelayList
            initialRelays={favoriteRelays}
            initialLoading={favoritesLoading}
          />
        </div>
      )}
    </div>
  )
}

function CollectionGroup({
  id,
  title,
  description,
  collections
}: {
  id?: string
  title: string
  description: string
  collections: TAwesomeRelayCollection[]
}) {
  if (!collections.length) {
    return (
      <div id={id} className="rounded-3xl border bg-card/60 p-5 scroll-mt-28">
        <div className="text-lg font-semibold">{title}</div>
        <div className="mt-1 text-sm text-muted-foreground">{description}</div>
        <div className="mt-6 space-y-2">
          <RelaySimpleInfoSkeleton className="h-auto rounded-2xl border px-4 py-3" />
        </div>
      </div>
    )
  }

  return (
    <section id={id} className="rounded-3xl border bg-card/60 p-5 scroll-mt-28">
      <div className="mb-5">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="space-y-6">
        {collections.map((collection) => (
          <RelayCollection key={collection.id} collection={collection} />
        ))}
      </div>
    </section>
  )
}

function RelayCollection({ collection }: { collection: TAwesomeRelayCollection }) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {collection.name}
        </div>
        <div className="text-sm text-muted-foreground">{collection.description}</div>
      </div>
      <div className="space-y-2">
        {collection.relays.map((url) => (
          <RelayItem key={url} url={url} />
        ))}
      </div>
    </div>
  )
}

function RelayItem({ url }: { url: string }) {
  const { push } = useSecondaryPage()
  const { relayInfo, isFetching } = useFetchRelayInfo(url)

  if (isFetching) {
    return <RelaySimpleInfoSkeleton className="h-auto rounded-2xl border px-4 py-3" />
  }

  if (!relayInfo) {
    return null
  }

  return (
    <RelaySimpleInfo
      key={relayInfo.url}
      className="clickable h-auto rounded-2xl border px-4 py-3"
      relayInfo={relayInfo}
      compact
      showPinButton
      onClick={(e) => {
        e.stopPropagation()
        push(toRelay(relayInfo.url))
      }}
    />
  )
}
