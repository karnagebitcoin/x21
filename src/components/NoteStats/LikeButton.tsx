import { Drawer, DrawerContent, DrawerOverlay } from '@/components/ui/drawer'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { ACTUAL_ZAP_SOUNDS, ZAP_SOUNDS } from '@/constants'
import { useNoteStatsById } from '@/hooks/useNoteStatsById'
import { createReactionDraftEvent } from '@/lib/draft-event'
import { getLightningAddressFromProfile } from '@/lib/lightning'
import { useNostr } from '@/providers/NostrProvider'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { useUserTrust } from '@/providers/UserTrustProvider'
import { useZap } from '@/providers/ZapProvider'
import client from '@/services/client.service'
import lightning from '@/services/lightning.service'
import noteStatsService from '@/services/note-stats.service'
import { TEmoji } from '@/types'
import { Loader, SmilePlus } from 'lucide-react'
import { Event } from 'nostr-tools'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import Emoji from '../Emoji'
import SuggestedEmojis from '../SuggestedEmojis'
import { formatCount } from './utils'

// Lazy load the heavy EmojiPicker component
const EmojiPicker = lazy(() => import('../EmojiPicker'))

function EmojiPickerFallback() {
  return (
    <div className="w-[350px] h-[400px] p-4 flex flex-col gap-2">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-8 w-full" />
      <div className="grid grid-cols-8 gap-2 flex-1">
        {Array.from({ length: 40 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-8 rounded" />
        ))}
      </div>
    </div>
  )
}

export default function LikeButton({ event }: { event: Event }) {
  const { t } = useTranslation()
  const { isSmallScreen } = useScreenSize()
  const { pubkey, publish, checkLogin } = useNostr()
  const { hideUntrustedInteractions, isUserTrusted } = useUserTrust()
  const { zapOnReactions, defaultZapSats, defaultZapComment, zapSound, isWalletConnected } = useZap()
  const [liking, setLiking] = useState(false)
  const [isEmojiReactionsOpen, setIsEmojiReactionsOpen] = useState(false)
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const [canZap, setCanZap] = useState(false)
  const noteStats = useNoteStatsById(event.id)
  const { myLastEmoji, likeCount } = useMemo(() => {
    const stats = noteStats || {}
    const myLike = stats.likes?.find((like) => like.pubkey === pubkey)
    const likes = hideUntrustedInteractions
      ? stats.likes?.filter((like) => isUserTrusted(like.pubkey))
      : stats.likes
    return { myLastEmoji: myLike?.emoji, likeCount: likes?.length }
  }, [noteStats, pubkey, hideUntrustedInteractions, isUserTrusted])

  useEffect(() => {
    if (!zapOnReactions || !isWalletConnected) {
      setCanZap(false)
      return
    }

    client.fetchProfile(event.pubkey).then((profile) => {
      if (!profile) return
      if (pubkey === profile.pubkey) return
      const lightningAddress = getLightningAddressFromProfile(profile)
      if (lightningAddress) setCanZap(true)
    })
  }, [event.pubkey, pubkey, zapOnReactions, isWalletConnected])

  const like = async (emoji: string | TEmoji) => {
    checkLogin(async () => {
      if (liking || !pubkey) return

      setLiking(true)

      try {
        if (!noteStats?.updatedAt) {
          await noteStatsService.fetchNoteStats(event, pubkey)
        }

        const reaction = createReactionDraftEvent(event, emoji)
        const seenOn = client.getSeenEventRelayUrls(event.id)
        const evt = await publish(reaction, { additionalRelayUrls: seenOn })
        noteStatsService.updateNoteStatsByEvents([evt])

        // UI is now updated - stop showing the loading state
        setLiking(false)

        // If "Zap on reactions" is enabled and the user can zap this note, send a zap in the background
        if (zapOnReactions && canZap) {
          // Process zap asynchronously without blocking the UI
          Promise.resolve().then(async () => {
            try {
              // Play zap sound when reaction is sent (only if wallet is connected)
              if (isWalletConnected && zapSound !== ZAP_SOUNDS.NONE) {
                let soundToPlay = zapSound
                // If random is selected, pick a random sound
                if (zapSound === ZAP_SOUNDS.RANDOM) {
                  const randomIndex = Math.floor(Math.random() * ACTUAL_ZAP_SOUNDS.length)
                  soundToPlay = ACTUAL_ZAP_SOUNDS[randomIndex]
                }
                const audio = new Audio(`/sounds/${soundToPlay}.mp3`)
                audio.volume = 0.5
                audio.play().catch(() => {
                  // Ignore errors (e.g., autoplay policy restrictions)
                })
              }

              const zapResult = await lightning.zap(pubkey, event, defaultZapSats, defaultZapComment)
              // user canceled
              if (zapResult) {
                noteStatsService.addZap(
                  pubkey,
                  event.id,
                  zapResult.invoice,
                  defaultZapSats,
                  defaultZapComment
                )
              }
            } catch (error) {
              toast.error(`${t('Zap failed')}: ${(error as Error).message}`)
            }
          })
        }
      } catch (error) {
        console.error('like failed', error)
        setLiking(false)
      }
    })
  }

  const trigger = (
    <button
      className="flex items-center enabled:hover:text-primary gap-1 px-3 h-full text-muted-foreground"
      title={t('Like')}
      disabled={liking}
      onClick={() => {
        if (isSmallScreen) {
          setIsEmojiReactionsOpen(true)
        }
      }}
      aria-label={myLastEmoji ? `${t('React')}, ${t('you reacted')}` : t('React')}
      aria-pressed={!!myLastEmoji}
    >
      {liking ? (
        <Loader className="animate-spin" aria-hidden="true" />
      ) : myLastEmoji ? (
        <>
          <Emoji emoji={myLastEmoji} classNames={{ img: 'size-4', text: 'text-base' }} />
          {!!likeCount && <div className="text-sm ml-1" aria-label={`${likeCount} ${likeCount === 1 ? t('reaction') : t('reactions')}`}>{formatCount(likeCount)}</div>}
        </>
      ) : (
        <>
          <SmilePlus aria-hidden="true" />
          {!!likeCount && <div className="text-sm ml-1" aria-label={`${likeCount} ${likeCount === 1 ? t('reaction') : t('reactions')}`}>{formatCount(likeCount)}</div>}
        </>
      )}
    </button>
  )

  if (isSmallScreen) {
    return (
      <>
        {trigger}
        <Drawer open={isEmojiReactionsOpen} onOpenChange={setIsEmojiReactionsOpen}>
          <DrawerOverlay onClick={() => setIsEmojiReactionsOpen(false)} />
          <DrawerContent hideOverlay>
            <Suspense fallback={<EmojiPickerFallback />}>
              <EmojiPicker
                showFavorites
                onEmojiClick={(emoji) => {
                  setIsEmojiReactionsOpen(false)
                  if (!emoji) return

                  like(emoji)
                }}
              />
            </Suspense>
          </DrawerContent>
        </Drawer>
      </>
    )
  }

  return (
    <DropdownMenu
      open={isEmojiReactionsOpen}
      onOpenChange={(open) => {
        setIsEmojiReactionsOpen(open)
        if (open) {
          setIsPickerOpen(false)
        }
      }}
    >
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent side="top" className="p-0 w-fit">
        {isPickerOpen ? (
          <Suspense fallback={<EmojiPickerFallback />}>
            <EmojiPicker
              onEmojiClick={(emoji, e) => {
                e.stopPropagation()
                setIsEmojiReactionsOpen(false)
                if (!emoji) return

                like(emoji)
              }}
            />
          </Suspense>
        ) : (
          <SuggestedEmojis
            onEmojiClick={(emoji) => {
              setIsEmojiReactionsOpen(false)
              like(emoji)
            }}
            onMoreButtonClick={() => {
              setIsPickerOpen(true)
            }}
          />
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
