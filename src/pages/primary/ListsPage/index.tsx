import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import PrimaryPageLayout from '@/layouts/PrimaryPageLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useNostr } from '@/providers/NostrProvider'
import { useSecondaryPage } from '@/PageManager'
import { useLists } from '@/providers/ListsProvider'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { TPageRef } from '@/types'
import { Plus, Edit, Trash2, Users, Search, ArrowLeft, UserPlus, Share2, Loader2, Star, Pin, Check } from 'lucide-react'
import { toCreateList, toList, toEditList } from '@/lib/link'
import UserAvatar from '@/components/UserAvatar'
import Username from '@/components/Username'
import PinButton from '@/components/PinButton'

import ListZapButton from '@/components/ListZapButton'
import listStatsService from '@/services/list-stats.service'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { ArrowUpDown } from 'lucide-react'
import client from '@/services/client.service'
import { ExtendedKind, BIG_RELAY_URLS } from '@/constants'
import { Event, nip19 } from 'nostr-tools'
import { TStarterPack } from '@/providers/ListsProvider'
import NoteList from '@/components/NoteList'
import { useFollowList } from '@/providers/FollowListProvider'
import { createFollowListDraftEvent } from '@/lib/draft-event'
import localStorageService from '@/services/local-storage.service'
import ProfileList from '@/components/ProfileList'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useDeckView } from '@/providers/DeckViewProvider'
import { useLayoutMode } from '@/providers/LayoutModeProvider'
import { DECK_VIEW_MODE, LAYOUT_MODE } from '@/constants'
import ShareListDialog from '@/components/ShareListDialog'

const ListsPage = forwardRef((_, ref) => {
  const { t } = useTranslation()
  const layoutRef = useRef<TPageRef>(null)
  const { pubkey, checkLogin, publish, updateFollowListEvent } = useNostr()
  const { push } = useSecondaryPage()
  const { lists, isLoading: isLoadingMyLists, deleteList, fetchLists } = useLists()
  const { followings } = useFollowList()
  const { deckViewMode, pinColumn, pinnedColumns } = useDeckView()
  const { layoutMode } = useLayoutMode()
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<TStarterPack[]>([])
  const [allPublicLists, setAllPublicLists] = useState<TStarterPack[]>([])
  const [isLoadingPublicLists, setIsLoadingPublicLists] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [listToDelete, setListToDelete] = useState<string | null>(null)
  const [selectedList, setSelectedList] = useState<TStarterPack | null>(null)
  const [isLoadingSelectedList, setIsLoadingSelectedList] = useState(false)
  const [favoriteLists, setFavoriteLists] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState('notes')
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set())
  const [followedLists, setFollowedLists] = useState<Set<string>>(new Set())
  const [shareDialogOpen, setShareDialogOpen] = useState(false)
  const [sortBy, setSortBy] = useState<'recent' | 'zaps'>('recent')

  useImperativeHandle(ref, () => layoutRef.current)

  useEffect(() => {
    if (pubkey) {
      fetchLists()
    }
  }, [pubkey])

  useEffect(() => {
    setFavoriteLists(localStorageService.getFavoriteLists(pubkey))
  }, [pubkey])

  // Fetch list stats for all lists
  useEffect(() => {
    if (lists && lists.length > 0) {
      lists.forEach((list) => {
        listStatsService.fetchListStats(list.event.pubkey, list.id, pubkey)
      })
    }
  }, [lists, pubkey])

  // Fetch list stats for public lists
  useEffect(() => {
    if (allPublicLists && allPublicLists.length > 0) {
      allPublicLists.forEach((list) => {
        listStatsService.fetchListStats(list.event.pubkey, list.id, pubkey)
      })
    }
  }, [allPublicLists, pubkey])

  // Fetch public starter packs from relays on mount
  useEffect(() => {
    const fetchPublicLists = async () => {
      setIsLoadingPublicLists(true)
      try {
        // Fetch recent starter pack events from big relays
        const events = await client.fetchEvents(BIG_RELAY_URLS.slice(0, 5), {
          kinds: [ExtendedKind.STARTER_PACK],
          limit: 50
        })

        const parsedLists: TStarterPack[] = events.map((event) => parseStarterPackEvent(event))

        // Sort by event creation time (most recent first)
        parsedLists.sort((a, b) => b.event.created_at - a.event.created_at)

        // Remove duplicates (same author + d-tag)
        const uniqueLists = parsedLists.filter((list, index, self) =>
          index === self.findIndex((l) =>
            l.event.pubkey === list.event.pubkey && l.id === list.id
          )
        )

        setAllPublicLists(uniqueLists)
      } catch (error) {
        console.error('Failed to fetch public lists:', error)
      } finally {
        setIsLoadingPublicLists(false)
      }
    }

    fetchPublicLists()
  }, [])

  // Search functionality
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }

    setIsSearching(true)

    const searchInLists = () => {
      const query = searchQuery.toLowerCase()
      const filtered = allPublicLists.filter((list) => {
        return (
          list.title.toLowerCase().includes(query) ||
          list.description?.toLowerCase().includes(query)
        )
      })
      setSearchResults(filtered)
      setIsSearching(false)
    }

    const debounce = setTimeout(searchInLists, 300)
    return () => clearTimeout(debounce)
  }, [searchQuery, allPublicLists])

  const parseStarterPackEvent = (event: Event): TStarterPack => {
    const dTag = event.tags.find((tag) => tag[0] === 'd')?.[1] || ''
    const title = event.tags.find((tag) => tag[0] === 'title')?.[1] || 'Untitled List'
    const description = event.tags.find((tag) => tag[0] === 'description')?.[1]
    const image = event.tags.find((tag) => tag[0] === 'image')?.[1]
    const pubkeys = event.tags?.filter((tag) => tag[0] === 'p').map((tag) => tag[1]) || []

    return {
      id: dTag,
      title,
      description,
      image,
      pubkeys,
      event
    }
  }

  const handleCreateList = () => {
    if (!pubkey) {
      checkLogin()
      return
    }
    push(toCreateList())
  }

  const handleListClick = async (listId: string) => {
    // Parse listId - could be "d-tag" or "pubkey:d-tag"
    let ownerPubkey: string | undefined
    let dTag: string

    if (listId.includes(':')) {
      const [pubkey, tag] = listId.split(':')
      ownerPubkey = pubkey
      dTag = tag
    } else {
      ownerPubkey = pubkey ?? undefined
      dTag = listId
    }

    // Check if it's in our lists
    const ownList = Array.isArray(lists) ? lists.find((l) => l.id === dTag) : null

    if (ownList) {
      setSelectedList(ownList)
      // Fetch list stats for the selected list
      listStatsService.fetchListStats(ownList.event.pubkey, ownList.id, pubkey)
      return
    }

    // Otherwise, fetch the external list
    if (!ownerPubkey || !dTag) return

    setIsLoadingSelectedList(true)
    try {
      const events = await client.fetchEvents(BIG_RELAY_URLS.slice(0, 5), {
        kinds: [ExtendedKind.STARTER_PACK],
        authors: [ownerPubkey],
        '#d': [dTag],
        limit: 1
      })

      if (events.length > 0) {
        const event = events[0]
        const parsedList = parseStarterPackEvent(event)
        setSelectedList(parsedList)
        // Fetch list stats for the selected list
        listStatsService.fetchListStats(parsedList.event.pubkey, parsedList.id, pubkey)
      } else {
        toast.error(t('List not found'))
      }
    } catch (error) {
      console.error('Failed to fetch list:', error)
      toast.error(t('Failed to load list'))
    } finally {
      setIsLoadingSelectedList(false)
    }
  }

  const handleEditList = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    push(toEditList(id))
  }

  const handleDeleteList = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setListToDelete(id)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!listToDelete) return

    const { unwrap } = toast.promise(deleteList(listToDelete), {
      loading: t('Deleting list...'),
      success: t('List deleted!'),
      error: (err) => t('Failed to delete list: {{error}}', { error: err.message })
    })
    await unwrap()
    setDeleteDialogOpen(false)
    setListToDelete(null)
  }

  const handleFollowAll = async () => {
    if (!pubkey) {
      checkLogin()
      return
    }

    // Ensure selectedList.pubkeys is an array
    const listPubkeys = Array.isArray(selectedList?.pubkeys) ? selectedList.pubkeys : []

    if (!selectedList || listPubkeys.length === 0) {
      toast.error(t('No members to follow'))
      return
    }

    // Ensure followings is an array
    const currentFollowing = Array.isArray(followings) ? followings : []

    // Filter out already followed pubkeys and self
    const pubkeysToFollow = listPubkeys.filter(
      (pk) => pk && !currentFollowing.includes(pk) && pk !== pubkey
    )

    if (pubkeysToFollow.length === 0) {
      toast.info(t('You are already following everyone in this list'))
      return
    }

    const listKey = `${selectedList.event.pubkey}:${selectedList.id}`

    const { unwrap } = toast.promise(
      (async () => {
        // Create a new follow list event with all the new follows at once
        const followListEvent = await client.fetchFollowListEvent(pubkey)
        const existingTags = followListEvent?.tags ?? []
        const newTags = [...existingTags]

        // Add new p tags for users to follow
        pubkeysToFollow.forEach(pk => {
          if (!newTags.some(tag => tag[0] === 'p' && tag[1] === pk)) {
            newTags.push(['p', pk])
          }
        })

        const newFollowListDraftEvent = createFollowListDraftEvent(
          newTags,
          followListEvent?.content
        )

        const newFollowListEvent = await publish(newFollowListDraftEvent)
        await updateFollowListEvent(newFollowListEvent)

        // Mark list as followed
        setFollowedLists(prev => new Set(prev).add(listKey))
      })(),
      {
        loading: t('Following {{count}} users...', { count: pubkeysToFollow.length }),
        success: t('Successfully followed {{count}} users!', { count: pubkeysToFollow.length }),
        error: (err) => t('Failed to follow users: {{error}}', { error: err.message })
      }
    )
    await unwrap()
  }

  const handleShare = () => {
    if (!selectedList) return
    setShareDialogOpen(true)
  }

  const sortLists = (lists: TStarterPack[]) => {
    if (sortBy === 'zaps') {
      return [...lists].sort((a, b) => {
        const aZaps = listStatsService.getTotalZapAmount(a.event.pubkey, a.id)
        const bZaps = listStatsService.getTotalZapAmount(b.event.pubkey, b.id)
        return bZaps - aZaps
      })
    }
    // Default to recent (by creation time)
    return [...lists].sort((a, b) => b.event.created_at - a.event.created_at)
  }

  const toggleFavorite = (e: React.MouseEvent, listKey: string) => {
    e.stopPropagation()
    const isFavorite = localStorageService.isFavoriteList(listKey, pubkey)

    if (isFavorite) {
      localStorageService.removeFavoriteList(listKey, pubkey)
      toast.success(t('Removed from favorites'))
    } else {
      localStorageService.addFavoriteList(listKey, pubkey)
      toast.success(t('Added to favorites'))
    }

    // Update the state immediately to reflect the change
    setFavoriteLists(localStorageService.getFavoriteLists(pubkey))
  }

  const renderListCard = (list: TStarterPack, isOwned: boolean = false) => {
    // Ensure we have a valid pubkeys array
    const pubkeys = Array.isArray(list?.pubkeys) ? list.pubkeys : []
    const memberCount = pubkeys.length
    const listKey = `${list.event.pubkey}:${list.id}`
    const isFavorite = favoriteLists.includes(listKey)
    const isExpanded = expandedDescriptions.has(listKey)
    const descriptionNeedsTruncation = (list.description?.length || 0) > 140
    const isMultiColumn = layoutMode === LAYOUT_MODE.FULL_WIDTH && deckViewMode === DECK_VIEW_MODE.MULTI_COLUMN
    const isPinned = pinnedColumns.some((col) => col.type === 'list' && col.props?.listId === listKey)

    const handleFollowAllClick = async (e: React.MouseEvent) => {
      e.stopPropagation()

      if (!pubkey) {
        checkLogin()
        return
      }

      if (memberCount === 0) {
        toast.error(t('No members to follow'))
        return
      }

      // Ensure followings is an array
      const currentFollowing = Array.isArray(followings) ? followings : []

      // Filter out already followed pubkeys and self
      const pubkeysToFollow = pubkeys.filter(
        (pk) => pk && !currentFollowing.includes(pk) && pk !== pubkey
      )

      if (pubkeysToFollow.length === 0) {
        toast.info(t('You are already following everyone in this list'))
        return
      }

      const { unwrap } = toast.promise(
        (async () => {
          // Create a new follow list event with all the new follows at once
          const followListEvent = await client.fetchFollowListEvent(pubkey)
          const existingTags = followListEvent?.tags ?? []
          const newTags = [...existingTags]

          // Add new p tags for users to follow
          pubkeysToFollow.forEach(pk => {
            if (!newTags.some(tag => tag[0] === 'p' && tag[1] === pk)) {
              newTags.push(['p', pk])
            }
          })

          const newFollowListDraftEvent = createFollowListDraftEvent(
            newTags,
            followListEvent?.content
          )

          const newFollowListEvent = await publish(newFollowListDraftEvent)
          await updateFollowListEvent(newFollowListEvent)

          // Mark list as followed
          setFollowedLists(prev => new Set(prev).add(listKey))
        })(),
        {
          loading: t('Following {{count}} users...', { count: pubkeysToFollow.length }),
          success: t('Successfully followed {{count}} users!', { count: pubkeysToFollow.length }),
          error: (err) => t('Failed to follow users: {{error}}', { error: err.message })
        }
      )
      await unwrap()
    }

    const handlePinClick = (e: React.MouseEvent) => {
      e.stopPropagation()

      if (isPinned) {
        toast.info(t('List already pinned'))
        return
      }

      pinColumn({
        type: 'list',
        props: {
          listId: listKey,
          title: list.title
        }
      })
      toast.success(t('List pinned to deck view'))
    }

    return (
      <Card
        key={`${list.event.pubkey}-${list.id}`}
        className="cursor-pointer hover:bg-accent/50 transition-colors overflow-hidden"
        onClick={() => handleListClick(`${list.event.pubkey}:${list.id}`)}
      >
        <CardContent className="p-4">
          <div className="flex flex-col gap-3">
            {/* Header with image and title */}
            <div className="flex items-start gap-3">
              {list.image && (
                <img
                  src={list.image}
                  alt={list.title}
                  className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-lg line-clamp-2 mb-1">{list.title}</h3>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-muted-foreground">
                    {memberCount}{' '}
                    {memberCount === 1 ? t('member') : t('members')}
                  </span>
                  {!isOwned && (
                    <>
                      <span className="text-muted-foreground">•</span>
                      <div className="text-sm text-muted-foreground inline-flex items-center gap-1">
                        <span>By</span>
                        <UserAvatar userId={list.event.pubkey} size="xSmall" className="inline-block" />
                        <Username userId={list.event.pubkey} className="font-medium inline" />
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                {!isOwned && (
                  <Button
                    variant={followedLists.has(listKey) ? "default" : "outline"}
                    size="sm"
                    onClick={handleFollowAllClick}
                    title={followedLists.has(listKey) ? t('Followed all members') : t('Follow all members')}
                    className="text-xs px-2 h-8 whitespace-nowrap"
                  >
                    {followedLists.has(listKey) ? (
                      <>
                        <Check className="w-3 h-3 mr-1" />
                        {t('Followed')}
                      </>
                    ) : (
                      t('Follow all')
                    )}
                  </Button>
                )}
                {isMultiColumn && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handlePinClick}
                    title={isPinned ? t('List already pinned') : t('Pin list as column')}
                    className={isPinned ? 'text-primary' : ''}
                  >
                    <Pin className="w-4 h-4" />
                  </Button>
                )}
                <div onClick={(e) => e.stopPropagation()}>
                  <ListZapButton
                    authorPubkey={list.event.pubkey}
                    dTag={list.id}
                    variant="compact"
                    className="h-8 px-2"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => toggleFavorite(e, listKey)}
                  title={isFavorite ? t('Remove from favorites') : t('Add to favorites')}
                >
                  <Star className={`w-4 h-4 ${isFavorite ? 'fill-current text-yellow-500' : 'text-muted-foreground'}`} />
                </Button>
                {isOwned && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => handleEditList(e, list.id)}
                      title={t('Edit')}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => handleDeleteList(e, list.id)}
                      title={t('Delete')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Description */}
            {list.description && (
              <div className="text-sm text-muted-foreground">
                {descriptionNeedsTruncation && !isExpanded ? (
                  <>
                    {list.description.substring(0, 140)}...{' '}
                    <button
                      className="text-primary hover:underline"
                      onClick={(e) => {
                        e.stopPropagation()
                        setExpandedDescriptions(prev => new Set(prev).add(listKey))
                      }}
                    >
                      {t('more')}
                    </button>
                  </>
                ) : (
                  list.description
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  let content: React.ReactNode = null

  // Show selected list view
  if (selectedList) {
    const isOwnList = selectedList.event?.pubkey === pubkey
    const pubkeys = Array.isArray(selectedList?.pubkeys) ? selectedList.pubkeys : []
    const memberCount = pubkeys.length
    const validPubkeys = pubkeys.filter(pk => pk && typeof pk === 'string' && pk.length > 0)
    const selectedListKey = `${selectedList.event.pubkey}:${selectedList.id}`

    content = (
      <div className="flex flex-col h-full">
        {/* List Header */}
        <div className="border-b px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedList(null)}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t('Back to Lists')}
            </Button>

            {memberCount > 0 && (
              <div className="flex gap-2">
                <ListZapButton
                  authorPubkey={selectedList.event.pubkey}
                  dTag={selectedList.id}
                  variant="compact"
                  className="h-9 px-3"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    const listKey = `${selectedList.event.pubkey}:${selectedList.id}`
                    toggleFavorite(e, listKey)
                  }}
                  title={favoriteLists.includes(`${selectedList.event.pubkey}:${selectedList.id}`) ? t('Remove from favorites') : t('Add to favorites')}
                >
                  <Star className={`w-4 h-4 ${favoriteLists.includes(`${selectedList.event.pubkey}:${selectedList.id}`) ? 'fill-current text-yellow-500' : 'text-muted-foreground'}`} />
                </Button>
                <Button
                  variant={followedLists.has(selectedListKey) ? "default" : "outline"}
                  size="sm"
                  onClick={handleFollowAll}
                  disabled={!pubkey}
                >
                  {followedLists.has(selectedListKey) ? (
                    <>
                      <Check className="w-4 h-4 mr-1" />
                      {t('Followed')}
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4 mr-1" />
                      {t('Follow All')}
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleShare}
                >
                  <Share2 className="w-4 h-4 mr-1" />
                  {t('Share')}
                </Button>
              </div>
            )}
          </div>

          <div className="flex items-start gap-4">
            {selectedList.image && (
              <img
                src={selectedList.image}
                alt={selectedList.title}
                className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-2xl font-bold mb-1">{selectedList.title}</h2>
                {isOwnList && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => push(toEditList(selectedList.id))}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    {t('Edit')}
                  </Button>
                )}
              </div>
              {!isOwnList && (
                <div className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
                  <span>{t('By')}</span>
                  <UserAvatar userId={selectedList.event.pubkey} size="small" />
                  <Username userId={selectedList.event.pubkey} className="font-medium" />
                </div>
              )}
              <div className="text-sm text-muted-foreground mb-3">
                {memberCount}{' '}
                {memberCount === 1 ? t('member') : t('members')}
              </div>
              {selectedList.description && (
                <p className="text-sm text-muted-foreground">
                  {selectedList.description.length > 140 ? (
                    <>
                      {expandedDescriptions.has(`${selectedList.event.pubkey}:${selectedList.id}`) ? (
                        selectedList.description
                      ) : (
                        <>
                          {selectedList.description.substring(0, 140)}...{' '}
                          <button
                            className="text-primary hover:underline"
                            onClick={(e) => {
                              e.stopPropagation()
                              const listKey = `${selectedList.event.pubkey}:${selectedList.id}`
                              setExpandedDescriptions(prev => new Set(prev).add(listKey))
                            }}
                          >
                            {t('more')}
                          </button>
                        </>
                      )}
                    </>
                  ) : (
                    selectedList.description
                  )}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-auto">
          {validPubkeys.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <Users className="w-16 h-16 text-muted-foreground opacity-50" />
              <div className="text-muted-foreground">{t('No members in this list')}</div>
              {isOwnList && (
                <Button onClick={() => push(toEditList(selectedList.id))} variant="outline">
                  {t('Add Members')}
                </Button>
              )}
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <div className="border-b">
                <TabsList className="w-full justify-start h-auto p-0 bg-transparent px-4">
                  <TabsTrigger
                    value="notes"
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-3"
                  >
                    {t('Notes')}
                  </TabsTrigger>
                  <TabsTrigger
                    value="people"
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-3"
                  >
                    {t('People')} ({memberCount})
                  </TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="notes" className="mt-0">
                <NoteList
                  subRequests={[
                    {
                      urls: BIG_RELAY_URLS,
                      filter: {
                        authors: validPubkeys,
                        kinds: [1, 6]
                      }
                    }
                  ]}
                  showKinds={[1, 6]}
                />
              </TabsContent>
              <TabsContent value="people" className="mt-0">
                <ProfileList pubkeys={validPubkeys} compactFollowButton />
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    )
  } else if (isLoadingSelectedList) {
    content = (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">{t('Loading list...')}</div>
      </div>
    )
  } else if (!pubkey) {
    content = (
      <div className="flex flex-col items-center justify-center w-full pt-8 gap-4">
        <Users className="w-16 h-16 opacity-50" />
        <p className="text-muted-foreground">{t('Login to create and manage your lists')}</p>
        <Button size="lg" onClick={() => checkLogin()}>
          {t('Login')}
        </Button>
      </div>
    )
  } else {
    content = (
      <div className="p-4 space-y-6">
        {/* Search Bar */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('Search lists...')}
                className="pl-9"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="default">
                  <ArrowUpDown className="w-4 h-4 mr-1" />
                  {sortBy === 'zaps' ? t('Zaps') : t('Recent')}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setSortBy('recent')}>
                  {t('Recent')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy('zaps')}>
                  {t('Zaps')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={handleCreateList} size="default">
              <Plus className="w-4 h-4 mr-1" />
              {t('Create')}
            </Button>
          </div>
        </div>

        {/* Search Results */}
        {searchQuery && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">{t('Search Results')}</h2>
            {isSearching && (
              <div className="text-center text-muted-foreground py-8">{t('Searching...')}</div>
            )}
            {!isSearching && (!searchResults || searchResults.length === 0) && (
              <div className="text-center text-muted-foreground py-8">
                {t('No starter packs found')}
              </div>
            )}
            {searchResults && searchResults.length > 0 && (
              <div className="grid gap-4">
                {sortLists(searchResults).map((list) => renderListCard(list, list?.event?.pubkey === pubkey))}
              </div>
            )}
          </div>
        )}

        {/* Favorites */}
        {!searchQuery && favoriteLists.length > 0 && (() => {
          const favListObjects: TStarterPack[] = []
          favoriteLists.forEach((listKey) => {
            const [pubkeyPart, idPart] = listKey.split(':')
            // Check if it's in my lists
            const ownList = lists.find((l) => l.id === idPart && l.event.pubkey === pubkeyPart)
            if (ownList) {
              favListObjects.push(ownList)
              return
            }
            // Check if it's in public lists
            const publicList = allPublicLists.find(
              (l) => l.id === idPart && l.event.pubkey === pubkeyPart
            )
            if (publicList) {
              favListObjects.push(publicList)
            }
          })

          if (favListObjects.length === 0) return null

          return (
            <div className="space-y-4">
              <h2 className="text-xl font-bold">{t('Favorites')}</h2>
              <div className="grid gap-4">
                {sortLists(favListObjects).map((list) =>
                  renderListCard(list, list.event.pubkey === pubkey)
                )}
              </div>
            </div>
          )
        })()}

        {/* My Lists */}
        {!searchQuery && lists && lists.length > 0 && (() => {
          const nonFavoriteLists = lists.filter((list) => {
            const listKey = `${list.event.pubkey}:${list.id}`
            return !favoriteLists.includes(listKey)
          })

          if (nonFavoriteLists.length === 0) return null

          return (
            <div className="space-y-4">
              <h2 className="text-xl font-bold">{t('My Lists')}</h2>

              {isLoadingMyLists && (
                <div className="text-center text-muted-foreground py-8">
                  {t('Loading lists...')}
                </div>
              )}

              <div className="grid gap-4">
                {sortLists(nonFavoriteLists).map((list) => renderListCard(list, true))}
              </div>
            </div>
          )
        })()}

        {/* Discover Public Lists */}
        {!searchQuery && (
          <div className="space-y-4">
            {isLoadingPublicLists && (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                <div className="text-center text-muted-foreground">
                  {t('Loading lists...')}
                </div>
              </div>
            )}

            {!isLoadingPublicLists && (() => {
              const nonFavoritePublicLists = (allPublicLists || []).filter((list) => {
                const listKey = `${list.event.pubkey}:${list.id}`
                return !favoriteLists.includes(listKey)
              })

              if (nonFavoritePublicLists.length === 0 && (!allPublicLists || allPublicLists.length === 0)) {
                return (
                  <div className="text-center text-muted-foreground py-8">
                    <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>{t('No starter packs found')}</p>
                    <p className="text-sm">{t('Try searching or create your own')}</p>
                  </div>
                )
              }

              if (nonFavoritePublicLists.length === 0) {
                return null
              }

              return (
                <div className="grid gap-4">
                  {sortLists(nonFavoritePublicLists).map((list) => renderListCard(list, list?.event?.pubkey === pubkey))}
                </div>
              )
            })()}
          </div>
        )}
      </div>
    )
  }

  return (
    <PrimaryPageLayout
      pageName="lists"
      ref={layoutRef}
      titlebar={<ListsPageTitlebar selectedList={selectedList} />}
      displayScrollToTopButton
    >
      {content}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Delete List?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('This action cannot be undone. This will permanently delete the list.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>{t('Delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Share List Dialog */}
      {selectedList && (
        <ShareListDialog
          open={shareDialogOpen}
          onOpenChange={setShareDialogOpen}
          listId={selectedList.id}
          ownerPubkey={selectedList.event.pubkey}
          title={selectedList.title}
          description={selectedList.description}
          image={selectedList.image}
          memberCount={selectedList.pubkeys.length}
        />
      )}
    </PrimaryPageLayout>
  )
})

ListsPage.displayName = 'ListsPage'
export default ListsPage

function ListsPageTitlebar({ selectedList }: { selectedList: TStarterPack | null }) {
  const { t } = useTranslation()
  const { isSmallScreen } = useScreenSize()

  return (
    <div className="flex gap-1 items-center h-full justify-between">
      <div className="font-semibold text-lg flex-1 pl-4 truncate">
        {selectedList ? selectedList.title : t('Lists')}
      </div>
      <div className="shrink-0 flex gap-1 items-center">
        <PinButton column={{ type: 'lists' }} size="titlebar-icon" />
      </div>
    </div>
  )
}
