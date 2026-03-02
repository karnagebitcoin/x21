import { getNoteBech32Id, isProtectedEvent, isReplyNoteEvent, getParentEventHexId, getRootEventHexId } from '@/lib/event'
import { toNjump } from '@/lib/link'
import { pubkeyToNpub } from '@/lib/pubkey'
import { simplifyUrl } from '@/lib/url'
import { useCurrentRelays } from '@/providers/CurrentRelaysProvider'
import { useFavoriteRelays } from '@/providers/FavoriteRelaysProvider'
import { useMuteList } from '@/providers/MuteListProvider'
import { useNostr } from '@/providers/NostrProvider'
import { usePinList } from '@/providers/PinListProvider'
import { useWidgets } from '@/providers/WidgetsProvider'
import { useAI } from '@/providers/AIProvider'
import { usePinnedReplies } from '@/providers/PinnedRepliesProvider'
import client from '@/services/client.service'
import {
  Bell,
  BellOff,
  Code,
  Copy,
  Link,
  Pin,
  PinOff,
  SatelliteDish,
  StickyNote,
  Trash2,
  TriangleAlert,
  PanelRightClose,
  MessageSquare
} from 'lucide-react'
import { Event, kinds } from 'nostr-tools'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import RelayIcon from '../RelayIcon'

export interface SubMenuAction {
  label: React.ReactNode
  onClick: () => void
  className?: string
  separator?: boolean
}

export interface MenuAction {
  icon: React.ComponentType
  label: string
  onClick?: () => void
  className?: string
  separator?: boolean
  subMenu?: SubMenuAction[]
}

interface UseMenuActionsProps {
  event: Event
  closeDrawer: () => void
  showSubMenuActions: (subMenu: SubMenuAction[], title: string) => void
  setIsRawEventDialogOpen: (open: boolean) => void
  setIsReportDialogOpen: (open: boolean) => void
  setIsPrivateNoteDialogOpen?: (open: boolean) => void
  isSmallScreen: boolean
}

export function useMenuActions({
  event,
  closeDrawer,
  showSubMenuActions,
  setIsRawEventDialogOpen,
  setIsReportDialogOpen,
  setIsPrivateNoteDialogOpen,
  isSmallScreen
}: UseMenuActionsProps) {
  const { t } = useTranslation()
  const { pubkey, attemptDelete } = useNostr()
  const { relayUrls: currentBrowsingRelayUrls } = useCurrentRelays()
  const { relaySets, favoriteRelays } = useFavoriteRelays()
  const relayUrls = useMemo(() => {
    return Array.from(new Set(currentBrowsingRelayUrls.concat(favoriteRelays)))
  }, [currentBrowsingRelayUrls, favoriteRelays])
  const { mutePubkey, unmutePubkey, mutePubkeySet } = useMuteList()
  const { pinnedEventHexIdSet, pin, unpin } = usePinList()
  const { pinNoteWidget, unpinNoteByEventId, isPinned: isWidgetPinned, openAIPrompt, closeAIPromptByEventId, isAIPromptOpen } = useWidgets()
  const { isConfigured: isAIConfigured } = useAI()
  const { isReplyPinned, pinReply, unpinReply } = usePinnedReplies()
  const isMuted = useMemo(() => mutePubkeySet.has(event.pubkey), [mutePubkeySet, event])
  const isPinnedToSidebar = useMemo(() => isWidgetPinned(event.id), [isWidgetPinned, event.id])
  const isAIPromptOpenForNote = useMemo(() => isAIPromptOpen(event.id), [isAIPromptOpen, event.id])

  // Check if this is a reply and get the thread ID
  const isReply = useMemo(() => isReplyNoteEvent(event), [event])
  const threadId = useMemo(() => {
    if (!isReply) return null
    // Use root event ID as the thread identifier
    const rootId = getRootEventHexId(event)
    if (rootId) return rootId
    // Fallback to parent if no root
    const parentId = getParentEventHexId(event)
    return parentId || null
  }, [isReply, event])
  const isPinnedToTop = useMemo(() => {
    if (!threadId) return false
    return isReplyPinned(threadId, event.id)
  }, [threadId, event.id, isReplyPinned])

  const broadcastSubMenu: SubMenuAction[] = useMemo(() => {
    const items = []
    if (pubkey && event.pubkey === pubkey) {
      items.push({
        label: <div className="text-left"> {t('Write relays')}</div>,
        onClick: async () => {
          closeDrawer()
          const promise = async () => {
            const relays = await client.determineTargetRelays(event)
            if (relays?.length) {
              await client.publishEvent(relays, event)
            }
          }
          toast.promise(promise, {
            loading: t('Republishing...'),
            success: () => {
              return t('Successfully republish to your write relays')
            },
            error: (err) => {
              return t('Failed to republish to your write relays: {{error}}', {
                error: err.message
              })
            }
          })
        }
      })
    }

    if (relaySets.length) {
      items.push(
        ...relaySets
          .filter((set) => set.relayUrls.length)
          .map((set, index) => ({
            label: <div className="text-left truncate">{set.name}</div>,
            onClick: async () => {
              closeDrawer()
              const promise = client.publishEvent(set.relayUrls, event)
              toast.promise(promise, {
                loading: t('Republishing...'),
                success: () => {
                  return t('Successfully republish to relay set: {{name}}', { name: set.name })
                },
                error: (err) => {
                  return t('Failed to republish to relay set: {{name}}. Error: {{error}}', {
                    name: set.name,
                    error: err.message
                  })
                }
              })
            },
            separator: index === 0
          }))
      )
    }

    if (relayUrls.length) {
      items.push(
        ...relayUrls.map((relay, index) => ({
          label: (
            <div className="flex items-center gap-2 w-full">
              <RelayIcon url={relay} />
              <div className="flex-1 truncate text-left">{simplifyUrl(relay)}</div>
            </div>
          ),
          onClick: async () => {
            closeDrawer()
            const promise = client.publishEvent([relay], event)
            toast.promise(promise, {
              loading: t('Republishing...'),
              success: () => {
                return t('Successfully republish to relay: {{url}}', { url: simplifyUrl(relay) })
              },
              error: (err) => {
                return t('Failed to republish to relay: {{url}}. Error: {{error}}', {
                  url: simplifyUrl(relay),
                  error: err.message
                })
              }
            })
          },
          separator: index === 0
        }))
      )
    }

    return items
  }, [pubkey, relayUrls, relaySets])

  const menuActions: MenuAction[] = useMemo(() => {
    const actions: MenuAction[] = [
      {
        icon: Copy,
        label: t('Copy event ID'),
        onClick: async () => {
          try {
            await navigator.clipboard.writeText(getNoteBech32Id(event))
            toast.success('Event ID copied')
          } catch (error) {
            console.error('Failed to copy event ID:', error)
            toast.error('Failed to copy')
          }
          closeDrawer()
        }
      },
      {
        icon: Copy,
        label: t('Copy user ID'),
        onClick: async () => {
          try {
            const npub = pubkeyToNpub(event.pubkey) ?? ''
            await navigator.clipboard.writeText(npub)
            toast.success('User ID copied')
          } catch (error) {
            console.error('Failed to copy user ID:', error)
            toast.error('Failed to copy')
          }
          closeDrawer()
        }
      },
      {
        icon: Link,
        label: t('Copy share link'),
        onClick: async () => {
          try {
            await navigator.clipboard.writeText(toNjump(getNoteBech32Id(event)))
            toast.success('Share link copied')
          } catch (error) {
            console.error('Failed to copy share link:', error)
            toast.error('Failed to copy')
          }
          closeDrawer()
        }
      },
      {
        icon: Code,
        label: t('View raw event'),
        onClick: () => {
          closeDrawer()
          setIsRawEventDialogOpen(true)
        },
        separator: true
      }
    ]

    const isProtected = isProtectedEvent(event)
    if (!isProtected || event.pubkey === pubkey) {
      actions.push({
        icon: SatelliteDish,
        label: t('Republish to ...'),
        onClick: isSmallScreen
          ? () => showSubMenuActions(broadcastSubMenu, t('Republish to ...'))
          : undefined,
        subMenu: isSmallScreen ? undefined : broadcastSubMenu,
        separator: true
      })
    }

    if (event.pubkey === pubkey && event.kind === kinds.ShortTextNote) {
      const pinned = pinnedEventHexIdSet.has(event.id)
      actions.push({
        icon: pinned ? PinOff : Pin,
        label: pinned ? t('Unpin from profile') : t('Pin to profile'),
        onClick: async () => {
          closeDrawer()
          await (pinned ? unpin(event) : pin(event))
        }
      })
    }

    // Pin to top of thread option (only for replies)
    if (isReply && threadId) {
      actions.push({
        icon: isPinnedToTop ? PinOff : Pin,
        label: isPinnedToTop ? t('Unpin from top') : t('Pin to top'),
        onClick: () => {
          closeDrawer()
          if (isPinnedToTop) {
            unpinReply(threadId, event.id)
            toast.success('Reply unpinned from top')
          } else {
            pinReply(threadId, event.id)
            toast.success('Reply pinned to top')
          }
        },
        separator: event.pubkey === pubkey && event.kind === kinds.ShortTextNote ? false : true
      })
    }

    // Pin to sidebar option (available for all users)
    if (pubkey) {
      actions.push({
        icon: isPinnedToSidebar ? PinOff : PanelRightClose,
        label: isPinnedToSidebar ? t('Unpin from sidebar') : t('Pin to sidebar'),
        onClick: () => {
          closeDrawer()
          if (isPinnedToSidebar) {
            unpinNoteByEventId(event.id)
            toast.success('Note unpinned from sidebar')
          } else {
            pinNoteWidget(event.id)
            toast.success('Note pinned to sidebar')
          }
        },
        separator: !isReply || !threadId
      })
    }

    // AI Prompt option (available when AI is configured)
    if (pubkey && isAIConfigured) {
      actions.push({
        icon: MessageSquare,
        label: isAIPromptOpenForNote ? t('Close AI Prompt') : t('AI Prompt'),
        onClick: () => {
          closeDrawer()
          if (isAIPromptOpenForNote) {
            closeAIPromptByEventId(event.id)
            toast.success('AI Prompt closed')
          } else {
            openAIPrompt(event.id)
            toast.success('AI Prompt opened')
          }
        }
      })
    }

    if (pubkey && event.pubkey !== pubkey && setIsPrivateNoteDialogOpen) {
      actions.push({
        icon: StickyNote,
        label: t('Pin to profile'),
        onClick: () => {
          closeDrawer()
          setIsPrivateNoteDialogOpen(true)
        },
        separator: true
      })
    }

    if (pubkey && event.pubkey !== pubkey) {
      actions.push({
        icon: TriangleAlert,
        label: t('Report'),
        className: 'text-destructive focus:text-destructive',
        onClick: () => {
          closeDrawer()
          setIsReportDialogOpen(true)
        },
        separator: !setIsPrivateNoteDialogOpen
      })
    }

    if (pubkey && event.pubkey !== pubkey) {
      if (isMuted) {
        actions.push({
          icon: Bell,
          label: t('Unmute user'),
          onClick: () => {
            closeDrawer()
            unmutePubkey(event.pubkey)
            toast.success('User unmuted')
          },
          className: 'text-destructive focus:text-destructive',
          separator: true
        })
      } else {
        actions.push({
          icon: BellOff,
          label: t('Mute user'),
          onClick: () => {
            closeDrawer()
            mutePubkey(event.pubkey)
            toast.success('User muted')
          },
          className: 'text-destructive focus:text-destructive',
          separator: true
        })
      }
    }

    if (pubkey && event.pubkey === pubkey) {
      actions.push({
        icon: Trash2,
        label: t('Try deleting this note'),
        onClick: () => {
          closeDrawer()
          attemptDelete(event)
        },
        className: 'text-destructive focus:text-destructive',
        separator: true
      })
    }

    return actions
  }, [
    t,
    event,
    pubkey,
    isMuted,
    isSmallScreen,
    broadcastSubMenu,
    pinnedEventHexIdSet,
    closeDrawer,
    showSubMenuActions,
    setIsRawEventDialogOpen,
    mutePubkey,
    unmutePubkey
  ])

  return menuActions
}
