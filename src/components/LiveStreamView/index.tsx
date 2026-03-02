import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Event as NostrEvent, nip19 } from 'nostr-tools'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Radio, Users, Send, Heart, Zap as ZapIcon } from 'lucide-react'
import UserAvatar from '@/components/UserAvatar'
import Username from '@/components/Username'
import Content from '@/components/Content'
import { FormattedTimestamp } from '@/components/FormattedTimestamp'
import client from '@/services/client.service'
import { useNostr } from '@/providers/NostrProvider'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { useSecondaryPage } from '@/PageManager'
import { formatAmount } from '@/lib/lightning'
import { getZapInfoFromEvent } from '@/lib/event-metadata'
import ZapDialog from '@/components/ZapDialog'

const DEFAULT_LIVE_RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band']

type DecodedLiveAddress = {
  identifier: string
  pubkey: string
  kind: number
  relays?: string[]
}

type LiveZap = {
  id: string
  pubkey: string
  amount: number
  created_at: number
  comment?: string
}

function decodeLiveNaddr(naddr?: string): DecodedLiveAddress | null {
  if (!naddr) return null

  try {
    const decoded = nip19.decode(naddr)
    if (decoded.type !== 'naddr') return null
    return decoded.data as DecodedLiveAddress
  } catch {
    return null
  }
}

function getAddressTag(decoded: DecodedLiveAddress): string {
  return `${decoded.kind}:${decoded.pubkey}:${decoded.identifier}`
}

export default function LiveStreamView({ naddr }: { naddr?: string }) {
  const { t } = useTranslation()
  const { pubkey, checkLogin, publish } = useNostr()
  const { isSmallScreen } = useScreenSize()
  const decodedEvent = useMemo(() => decodeLiveNaddr(naddr), [naddr])
  const [liveEvent, setLiveEvent] = useState<NostrEvent | null>(null)
  const [chatMessages, setChatMessages] = useState<NostrEvent[]>([])
  const [zaps, setZaps] = useState<LiveZap[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isStreamZapOpen, setIsStreamZapOpen] = useState(false)
  const [chatZapTarget, setChatZapTarget] = useState<NostrEvent | null>(null)
  const [isChatZapOpen, setIsChatZapOpen] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!decodedEvent) {
      setIsLoading(false)
      setLiveEvent(null)
      setChatMessages([])
      setZaps([])
      return
    }

    const relays =
      decodedEvent.relays && decodedEvent.relays.length > 0
        ? decodedEvent.relays
        : DEFAULT_LIVE_RELAYS
    const addressTag = getAddressTag(decodedEvent)

    setIsLoading(true)
    setLiveEvent(null)
    setChatMessages([])
    setZaps([])

    const liveSub = client.subscribe(
      relays,
      {
        kinds: [decodedEvent.kind],
        authors: [decodedEvent.pubkey],
        '#d': [decodedEvent.identifier],
        limit: 20
      },
      {
        onevent: (event: NostrEvent) => {
          setLiveEvent((previous) => {
            if (!previous) return event
            return event.created_at > previous.created_at ? event : previous
          })
        },
        oneose: (eosed: boolean) => {
          if (eosed) setIsLoading(false)
        }
      }
    )

    const chatSub = client.subscribe(
      relays,
      {
        kinds: [1311],
        '#a': [addressTag],
        limit: 300
      },
      {
        onevent: (event: NostrEvent) => {
          setChatMessages((previous) => {
            if (previous.some((item) => item.id === event.id)) return previous
            return [...previous, event].sort((a, b) => a.created_at - b.created_at)
          })
        }
      }
    )

    const zapsSub = client.subscribe(
      relays,
      {
        kinds: [9735],
        '#a': [addressTag],
        limit: 100
      },
      {
        onevent: (event: NostrEvent) => {
          const zapInfo = getZapInfoFromEvent(event)
          if (!zapInfo?.amount || !zapInfo.senderPubkey) return

          const senderPubkey = zapInfo.senderPubkey
          const amount = zapInfo.amount

          setZaps((previous) => {
            if (previous.some((item) => item.id === event.id)) return previous

            const nextZap: LiveZap = {
              id: event.id,
              pubkey: senderPubkey,
              amount,
              created_at: event.created_at,
              comment: zapInfo.comment
            }
            return [...previous, nextZap].sort((a, b) => b.created_at - a.created_at)
          })
        }
      }
    )

    return () => {
      liveSub.close()
      chatSub.close()
      zapsSub.close()
    }
  }, [decodedEvent])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const sendMessage = useCallback(async () => {
    if (!message.trim() || !decodedEvent || !pubkey) {
      await checkLogin()
      return
    }

    setIsSending(true)

    try {
      const draft = {
        kind: 1311,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['a', getAddressTag(decodedEvent), '', 'root']],
        content: message.trim()
      }

      const relays =
        decodedEvent.relays && decodedEvent.relays.length > 0
          ? decodedEvent.relays
          : DEFAULT_LIVE_RELAYS

      await publish(draft, { additionalRelayUrls: relays })
      setMessage('')
    } catch (error) {
      console.error('Failed to send live chat message:', error)
    } finally {
      setIsSending(false)
    }
  }, [message, decodedEvent, pubkey, checkLogin, publish])

  const zapLiveEvent = useCallback(() => {
    if (!liveEvent) return
    setIsStreamZapOpen(true)
  }, [liveEvent])

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="aspect-video w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    )
  }

  if (!liveEvent || !decodedEvent) {
    return (
      <div className="p-4 text-center text-muted-foreground">{t('Live stream not found')}</div>
    )
  }

  const title = liveEvent.tags.find((tag) => tag[0] === 'title')?.[1] || t('Untitled Live Stream')
  const summary = liveEvent.tags.find((tag) => tag[0] === 'summary')?.[1]
  const image = liveEvent.tags.find((tag) => tag[0] === 'image')?.[1]
  const streamingUrl = liveEvent.tags.find((tag) => tag[0] === 'streaming')?.[1]
  const currentParticipants = liveEvent.tags.find((tag) => tag[0] === 'current_participants')?.[1]
  const status = liveEvent.tags.find((tag) => tag[0] === 'status')?.[1]

  return (
    <div className="max-w-4xl mx-auto">
      <div className="p-4 space-y-4 border-b">
        <div className="flex items-start gap-3">
          <UserAvatar userId={liveEvent.pubkey} size="large" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-bold text-xl">{title}</h1>
              <Badge variant="destructive" className="bg-red-600 text-white flex items-center gap-1">
                <Radio className="w-3 h-3 animate-pulse" />
                {status === 'live' ? t('LIVE') : status?.toUpperCase()}
              </Badge>
            </div>
            <Username userId={liveEvent.pubkey} className="text-sm text-muted-foreground" />

            {currentParticipants && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                <Users className="w-4 h-4" />
                <span>
                  {currentParticipants} {t('watching')}
                </span>
              </div>
            )}
          </div>
        </div>

        {summary && <p className="text-sm text-muted-foreground">{summary}</p>}

        {streamingUrl && (
          <div className="aspect-video bg-black rounded-lg overflow-hidden">
            <video src={streamingUrl} controls autoPlay className="w-full h-full" />
          </div>
        )}

        {image && !streamingUrl && <img src={image} alt={title} className="w-full rounded-lg" />}

        <div className="flex gap-2">
          <Button onClick={zapLiveEvent} size="sm" variant="outline">
            <ZapIcon className="w-4 h-4 mr-2 text-yellow-500" />
            {t('Zap Stream')}
          </Button>
        </div>
      </div>

      {zaps.length > 0 && (
        <div className="p-4 border-b">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <ZapIcon className="w-4 h-4 text-yellow-500" />
            {t('Recent Zaps')}
          </h3>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
            {zaps.slice(0, 20).map((zap) => (
              <div
                key={zap.id}
                className="flex-shrink-0 flex items-center gap-2 bg-card border rounded-full px-3 py-1.5"
              >
                <UserAvatar userId={zap.pubkey} size="small" />
                <span className="text-sm font-semibold text-yellow-500">{formatAmount(zap.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="p-4 space-y-4">
        <h3 className="font-semibold">
          {t('Live Chat')} ({chatMessages.length})
        </h3>

        <div className="space-y-3 max-h-96 overflow-y-auto scrollbar-thin">
          {chatMessages.map((msg) => (
            <ChatMessage
              key={msg.id}
              event={msg}
              isSmallScreen={isSmallScreen}
              onZapMessage={(target) => {
                setChatZapTarget(target)
                setIsChatZapOpen(true)
              }}
            />
          ))}
          <div ref={chatEndRef} />

          {chatMessages.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-8">
              {t('No messages yet. Be the first to chat!')}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder={t('Type a message...')}
            className="resize-none"
            rows={2}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                sendMessage()
              }
            }}
          />
          <Button
            onClick={sendMessage}
            disabled={!message.trim() || isSending}
            size="icon"
            className="shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {liveEvent && (
        <ZapDialog
          open={isStreamZapOpen}
          setOpen={setIsStreamZapOpen}
          pubkey={liveEvent.pubkey}
          event={liveEvent}
        />
      )}

      {chatZapTarget && (
        <ZapDialog
          open={isChatZapOpen}
          setOpen={(next) => {
            const nextOpen = typeof next === 'function' ? next(isChatZapOpen) : next
            setIsChatZapOpen(nextOpen)
            if (!nextOpen) {
              setChatZapTarget(null)
            }
          }}
          pubkey={chatZapTarget.pubkey}
          event={chatZapTarget}
        />
      )}
    </div>
  )
}

function ChatMessage({
  event,
  isSmallScreen,
  onZapMessage
}: {
  event: NostrEvent
  isSmallScreen: boolean
  onZapMessage: (event: NostrEvent) => void
}) {
  const { push } = useSecondaryPage()

  const handleZapMessage = () => {
    onZapMessage(event)
  }

  const handleReact = async () => {
    // TODO: add reactions for live chat messages
  }

  return (
    <div className="flex gap-2 group hover:bg-accent/50 p-2 rounded-lg transition-colors">
      <button
        type="button"
        className="shrink-0 mt-0.5 cursor-pointer"
        onClick={() => push(`/users/${nip19.npubEncode(event.pubkey)}`)}
      >
        <UserAvatar userId={event.pubkey} size="small" noLink />
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <button
            type="button"
            className="text-sm font-semibold cursor-pointer hover:underline"
            onClick={() => push(`/users/${nip19.npubEncode(event.pubkey)}`)}
          >
            <Username userId={event.pubkey} noLink />
          </button>
          <FormattedTimestamp
            timestamp={event.created_at}
            className="text-xs text-muted-foreground"
            short={isSmallScreen}
          />
        </div>
        <Content content={event.content} className="text-sm mt-0.5" />

        <div className="flex gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleZapMessage}
            className="text-xs text-muted-foreground hover:text-yellow-500 flex items-center gap-1"
          >
            <ZapIcon className="w-3 h-3" />
          </button>
          <button
            onClick={handleReact}
            className="text-xs text-muted-foreground hover:text-red-500 flex items-center gap-1"
          >
            <Heart className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  )
}
