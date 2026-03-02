import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import NoteList from '@/components/NoteList'
import ProfileList from '@/components/ProfileList'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { useLists, TStarterPack } from '@/providers/ListsProvider'
import { useSecondaryPage } from '@/PageManager'
import { toEditList } from '@/lib/link'
import { Edit, Pin, Users, Check, UserPlus, Loader, Share2 } from 'lucide-react'
import { forwardRef, useMemo, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDeckView } from '@/providers/DeckViewProvider'
import { DECK_VIEW_MODE, ExtendedKind, BIG_RELAY_URLS } from '@/constants'
import { useLayoutMode } from '@/providers/LayoutModeProvider'
import { toast } from 'sonner'
import { useNostr } from '@/providers/NostrProvider'
import Username from '@/components/Username'
import UserAvatar from '@/components/UserAvatar'
import client from '@/services/client.service'
import { Event, nip19 } from 'nostr-tools'
import { useFollowList } from '@/providers/FollowListProvider'
import ShareListDialog from '@/components/ShareListDialog'
import ListPreviewDialog from '@/components/ListPreviewDialog'

type ListPageProps = {
  index?: number
  listId: string // Can be just "d-tag" for own lists or "pubkey:d-tag" for others' lists
}

const ListPage = forwardRef<HTMLDivElement, ListPageProps>(({ index, listId }, ref) => {
  const { t } = useTranslation()
  const { push } = useSecondaryPage()
  const { lists, isLoading: isLoadingMyLists } = useLists()
  const { deckViewMode, pinColumn, pinnedColumns } = useDeckView()
  const { layoutMode } = useLayoutMode()
  const { pubkey: myPubkey, checkLogin } = useNostr()
  const { followings, followMultiple } = useFollowList()
  const [externalList, setExternalList] = useState<TStarterPack | null>(null)
  const [isLoadingExternal, setIsLoadingExternal] = useState(false)
  const [isFollowingAll, setIsFollowingAll] = useState(false)
  const [activeTab, setActiveTab] = useState('notes')
  const [shareDialogOpen, setShareDialogOpen] = useState(false)

  // Parse listId - could be "d-tag" or "pubkey:d-tag"
  const { ownerPubkey, dTag } = useMemo(() => {
    if (listId.includes(':')) {
      const [pubkey, tag] = listId.split(':')
      return { ownerPubkey: pubkey, dTag: tag }
    }
    return { ownerPubkey: myPubkey, dTag: listId }
  }, [listId, myPubkey])

  const isOwnList = ownerPubkey === myPubkey

  // Try to find in own lists first
  const list = lists.find((l) => l.id === dTag)

  // Fetch external list if not found in own lists
  useEffect(() => {
    const fetchExternalList = async () => {
      if (isOwnList || list || !ownerPubkey || !dTag) return

      setIsLoadingExternal(true)
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
          setExternalList(parsedList)
        }
      } catch (error) {
        console.error('Failed to fetch external list:', error)
      } finally {
        setIsLoadingExternal(false)
      }
    }

    fetchExternalList()
  }, [ownerPubkey, dTag, isOwnList, list])

  const parseStarterPackEvent = (event: Event): TStarterPack => {
    const dTag = event.tags.find((tag) => tag[0] === 'd')?.[1] || ''
    const title = event.tags.find((tag) => tag[0] === 'title')?.[1] || 'Untitled List'
    const description = event.tags.find((tag) => tag[0] === 'description')?.[1]
    const image = event.tags.find((tag) => tag[0] === 'image')?.[1]
    const pubkeys = event.tags.filter((tag) => tag[0] === 'p').map((tag) => tag[1])

    return {
      id: dTag,
      title,
      description,
      image,
      pubkeys,
      event
    }
  }

  const displayList = list || externalList

  const isMultiColumn = layoutMode === 'full-width' && deckViewMode === DECK_VIEW_MODE.MULTI_COLUMN
  const isPinned = useMemo(
    () => pinnedColumns.some((col) => col.type === 'list' && col.props?.listId === listId),
    [pinnedColumns, listId]
  )

  // Calculate unfollowed users
  const unfollowedUsers = useMemo(() => {
    if (!displayList || !myPubkey) return []
    return displayList.pubkeys.filter(
      (pubkey) => pubkey !== myPubkey && !followings.includes(pubkey)
    )
  }, [displayList, followings, myPubkey])

  const handleEdit = () => {
    if (isOwnList) {
      push(toEditList(dTag))
    } else {
      toast.info(t('You can only edit your own lists'))
    }
  }

  const handlePin = () => {
    if (isPinned) {
      toast.info(t('This list is already pinned'))
      return
    }

    pinColumn({
      type: 'list',
      props: { listId, title: displayList?.title || 'List' }
    })
    toast.success(t('List pinned to deck view'))
  }

  const handleShare = () => {
    setShareDialogOpen(true)
  }

  const handleFollowAll = async () => {
    checkLogin(async () => {
      if (unfollowedUsers.length === 0) {
        toast.info(t('You are already following everyone in this list'))
        return
      }

      setIsFollowingAll(true)
      try {
        // Follow all users in a single operation
        await followMultiple(unfollowedUsers)

        const count = unfollowedUsers.length
        const word = count === 1 ? t('user') : t('users')
        toast.success(t('Followed {{count}} {{word}}', { count, word }))
      } catch (error) {
        console.error('Failed to follow all:', error)
        toast.error(t('Failed to follow all users'))
      } finally {
        setIsFollowingAll(false)
      }
    })
  }

  const isLoading = isLoadingMyLists || isLoadingExternal

  if (isLoading) {
    return (
      <SecondaryPageLayout ref={ref} index={index} title={t('Loading...')}>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">{t('Loading list...')}</div>
        </div>
      </SecondaryPageLayout>
    )
  }

  if (!displayList) {
    return (
      <SecondaryPageLayout ref={ref} index={index} title={t('List Not Found')}>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <Users className="w-16 h-16 text-muted-foreground opacity-50" />
          <div className="text-muted-foreground">{t('List not found')}</div>
        </div>
      </SecondaryPageLayout>
    )
  }

  return (
    <SecondaryPageLayout
      ref={ref}
      index={index}
      title={displayList.title}
      controls={
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="titlebar-icon"
            onClick={handleShare}
            title={t('Share List')}
          >
            <Share2 className="w-4 h-4" />
          </Button>
          {isMultiColumn && !isPinned && (
            <Button variant="ghost" size="titlebar-icon" onClick={handlePin} title={t('Pin to deck')}>
              <Pin className="w-4 h-4" />
            </Button>
          )}
          {isOwnList && (
            <Button variant="ghost" size="titlebar-icon" onClick={handleEdit} title={t('Edit')}>
              <Edit className="w-4 h-4" />
            </Button>
          )}
        </div>
      }
    >
      <div className="px-4 py-2">
        {displayList.image && (
          <div className="mb-4 rounded-lg overflow-hidden">
            <img
              src={displayList.image}
              alt={displayList.title}
              className="w-full h-48 object-cover"
            />
          </div>
        )}
        {ownerPubkey && (
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm text-muted-foreground">{t('by')}</span>
            <UserAvatar userId={ownerPubkey} size="small" />
            <Username userId={ownerPubkey} className="text-sm font-medium" />
          </div>
        )}
        <div className="text-sm text-muted-foreground mb-4">
          {displayList.pubkeys.length} {displayList.pubkeys.length === 1 ? t('member') : t('members')}
        </div>
        {displayList.description && (
          <div className="text-sm text-muted-foreground mb-4 pb-4 border-b">
            {displayList.description}
          </div>
        )}
      </div>

      {displayList.pubkeys.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <Users className="w-16 h-16 text-muted-foreground opacity-50" />
          <div className="text-muted-foreground">{t('No members in this list')}</div>
          {isOwnList && (
            <Button onClick={handleEdit} variant="outline">
              {t('Add Members')}
            </Button>
          )}
        </div>
      ) : (
        <>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full grid grid-cols-2 mx-4" style={{ width: 'calc(100% - 2rem)' }}>
            <TabsTrigger value="notes">{t('Notes')}</TabsTrigger>
            <TabsTrigger value="people">{t('People')}</TabsTrigger>
          </TabsList>

          <TabsContent value="notes" className="mt-0">
            <NoteList
              filter={{
                authors: displayList.pubkeys,
                kinds: [1, 6]
              }}
            />
          </TabsContent>

          <TabsContent value="people" className="mt-0">
            {myPubkey && unfollowedUsers.length > 0 && (
              <div className="px-4 py-3 border-b">
                <Button
                  onClick={handleFollowAll}
                  disabled={isFollowingAll}
                  className="w-full"
                  variant="outline"
                >
                  {isFollowingAll ? (
                    <>
                      <Loader className="w-4 h-4 mr-2 animate-spin" />
                      {t('Following...')}
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4 mr-2" />
                      {t('Follow All ({{count}})', { count: unfollowedUsers.length })}
                    </>
                  )}
                </Button>
              </div>
            )}
            <ProfileList pubkeys={displayList.pubkeys} />
          </TabsContent>
        </Tabs>
        </>
      )}

      {/* Share List Dialog */}
      {displayList && ownerPubkey && (
        <ShareListDialog
          open={shareDialogOpen}
          onOpenChange={setShareDialogOpen}
          listId={dTag}
          ownerPubkey={ownerPubkey}
          title={displayList.title}
          description={displayList.description}
          image={displayList.image}
          memberCount={displayList.pubkeys.length}
        />
      )}
    </SecondaryPageLayout>
  )
})
ListPage.displayName = 'ListPage'
export default ListPage
