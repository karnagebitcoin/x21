import { SimpleUserAvatar } from '@/components/UserAvatar'
import { SimpleUsername } from '@/components/Username'
import { Skeleton } from '@/components/ui/skeleton'
import { getReplaceableCoordinateFromEvent, isReplaceableEvent } from '@/lib/event'
import { toNote } from '@/lib/link'
import { cn } from '@/lib/utils'
import { useSecondaryPage } from '@/PageManager'
import { useDeletedEvent } from '@/providers/DeletedEventProvider'
import { useMuteList } from '@/providers/MuteListProvider'
import { useUserTrust } from '@/providers/UserTrustProvider'
import client from '@/services/client.service'
import { NostrEvent } from 'nostr-tools'
import { useEffect, useMemo, useState } from 'react'

const DISPLAY_COUNT = 16

export default function CompactTrendingNotes() {
  const { isEventDeleted } = useDeletedEvent()
  const { mutePubkeySet } = useMuteList()
  const { hideUntrustedNotes, isUserTrusted } = useUserTrust()
  const { push } = useSecondaryPage()
  const [trendingNotes, setTrendingNotes] = useState<NostrEvent[]>([])
  const [loading, setLoading] = useState(true)

  const filteredEvents = useMemo(() => {
    const idSet = new Set<string>()

    return trendingNotes.slice(0, DISPLAY_COUNT).filter((evt) => {
      if (isEventDeleted(evt)) return false
      if (mutePubkeySet.has(evt.pubkey)) return false
      if (hideUntrustedNotes && !isUserTrusted(evt.pubkey)) return false

      const id = isReplaceableEvent(evt.kind) ? getReplaceableCoordinateFromEvent(evt) : evt.id
      if (idSet.has(id)) {
        return false
      }
      idSet.add(id)
      return true
    })
  }, [trendingNotes, hideUntrustedNotes, isEventDeleted, isUserTrusted, mutePubkeySet])

  useEffect(() => {
    const fetchTrendingPosts = async () => {
      setLoading(true)
      try {
        const events = await client.fetchTrendingNotes()
        setTrendingNotes(events)
      } catch (error) {
        console.error('Failed to fetch trending notes:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchTrendingPosts()
  }, [])

  const getPlainText = (content: string): string => {
    // Remove URLs
    let text = content.replace(/https?:\/\/[^\s]+/g, '')
    // Remove nostr references (nostr:npub1..., nostr:note1..., etc.)
    text = text.replace(/nostr:[a-z0-9]+/gi, '')
    // Remove extra whitespace
    text = text.replace(/\s+/g, ' ').trim()
    return text
  }

  const truncateText = (text: string, maxLines: number = 2): string => {
    const plainText = getPlainText(text)
    // Rough estimate: ~50 chars per line for 2 lines
    const maxChars = maxLines * 50
    if (plainText.length <= maxChars) return plainText
    return plainText.slice(0, maxChars).trim() + '...'
  }

  if (loading) {
    return (
      <div className="space-y-3 pt-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-2">
            <Skeleton className="w-8 h-8 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-3 pt-3">
      {filteredEvents.map((event) => (
        <div
          key={event.id}
          className="flex gap-2 cursor-pointer hover:bg-accent/50 p-2 -m-2 rounded-md transition-colors"
          onClick={() => push(toNote(event.id))}
        >
          <SimpleUserAvatar userId={event.pubkey} size="compact" className="shrink-0" />
          <div className="flex-1 min-w-0 space-y-0.5">
            <SimpleUsername
              userId={event.pubkey}
              className={cn('text-sm font-medium text-muted-foreground truncate')}
            />
            <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
              {truncateText(event.content)}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
