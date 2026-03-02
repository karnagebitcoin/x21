// @ts-nocheck
import { useEffect, useState, useRef, useCallback, forwardRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Event, nip19 } from 'nostr-tools'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
import modalManager from '@/services/modal-manager.service'
import { formatAmount } from '@/lib/lightning'
import { cn } from '@/lib/utils'

interface LiveStreamPageProps {
  naddr?: string
  index?: number
}

const LiveStreamPage = forwardRef<any, LiveStreamPageProps>(({ naddr, index }, ref) => {
  const { t } = useTranslation()
  const { pubkey, checkLogin, signer } = useNostr()
  const { isSmallScreen } = useScreenSize()
  const [liveEvent, setLiveEvent] = useState<Event | null>(null)
  const [chatMessages, setChatMessages] = useState<Event[]>([])
  const [zaps, setZaps] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const chatSubIdRef = useRef<string | null>(null)
  const zapsSubIdRef = useRef<string | null>(null)

  // Decode naddr
  const decodedEvent = naddr ? (() => {
    try {
      const decoded = nip19.decode(naddr)
      if (decoded.type === 'naddr') {
        return decoded.data
      }
    } catch (e) {
      console.error('Failed to decode naddr:', e)
    }
    return null
  })() : null

  // Load live event and chat
  useEffect(() => {
    if (!decodedEvent) {
      setIsLoading(false)
      return
    }

    const loadLiveEvent = async () => {
      // Subscribe to the live event
      const relays = decodedEvent.relays && decodedEvent.relays.length > 0
        ? decodedEvent.relays
        : ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band']

      client.subscribe(
        relays,
        {
          kinds: [decodedEvent.kind],
          authors: [decodedEvent.pubkey],
          '#d': [decodedEvent.identifier]
        },
        (event: Event) => {
          setLiveEvent(event)
          setIsLoading(false)
        }
      )

      // Subscribe to chat messages (kind:1311)
      const chatSubId = client.subscribe(
        relays,
        {
          kinds: [1311],
          '#a': [`${decodedEvent.kind}:${decodedEvent.pubkey}:${decodedEvent.identifier}`],
          limit: 100
        },
        (event: Event) => {
          setChatMessages(prev => {
            // Avoid duplicates
            if (prev.some(e => e.id === event.id)) return prev
            return [...prev, event].sort((a, b) => a.created_at - b.created_at)
          })
        }
      )
      chatSubIdRef.current = chatSubId

      // Subscribe to zaps (kind:9735)
      const zapsSubId = client.subscribe(
        relays,
        {
          kinds: [9735],
          '#a': [`${decodedEvent.kind}:${decodedEvent.pubkey}:${decodedEvent.identifier}`],
          limit: 50
        },
        (event: Event) => {
          try {
            const zapRequest = JSON.parse(event.tags.find(t => t[0] === 'description')?.[1] || '{}')
            const bolt11 = event.tags.find(t => t[0] === 'bolt11')?.[1]

            if (bolt11) {
              // Parse amount from bolt11 (simplified)
              const amountMatch = bolt11.match(/lnbc(\d+)/)
              const amount = amountMatch ? parseInt(amountMatch[1]) / 1000 : 0

              setZaps(prev => {
                const newZap = {
                  id: event.id,
                  pubkey: zapRequest.pubkey || '',
                  amount,
                  created_at: event.created_at,
                  comment: zapRequest.content || ''
                }
                if (prev.some(z => z.id === event.id)) return prev
                return [...prev, newZap].sort((a, b) => b.created_at - a.created_at)
              })
            }
          } catch (e) {
            console.error('Failed to parse zap:', e)
          }
        }
      )
      zapsSubIdRef.current = zapsSubId
    }

    loadLiveEvent()

    return () => {
      if (chatSubIdRef.current) client.unsubscribe(chatSubIdRef.current)
      if (zapsSubIdRef.current) client.unsubscribe(zapsSubIdRef.current)
    }
  }, [decodedEvent])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const sendMessage = useCallback(async () => {
    if (!message.trim() || !decodedEvent || !pubkey) return

    const isLoggedIn = await checkLogin()
    if (!isLoggedIn) return

    setIsSending(true)

    try {
      const event: Event = {
        kind: 1311,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['a', `${decodedEvent.kind}:${decodedEvent.pubkey}:${decodedEvent.identifier}`, '', 'root']
        ],
        content: message,
        pubkey: pubkey
      } as any

      const signedEvent = await signer.signEvent(event)

      const relays = decodedEvent.relays && decodedEvent.relays.length > 0
        ? decodedEvent.relays
        : ['wss://relay.damus.io', 'wss://nos.lol']

      await client.publish(relays, signedEvent)
      setMessage('')
    } catch (error) {
      console.error('Failed to send message:', error)
    } finally {
      setIsSending(false)
    }
  }, [message, decodedEvent, pubkey, checkLogin, signer])

  const zapLiveEvent = useCallback(() => {
    if (!liveEvent) return
    modalManager.openZapDialog({ event: liveEvent })
  }, [liveEvent])

  if (isLoading) {
    return (
      <SecondaryPageLayout ref={ref} index={index} title={t('Live Stream')}>
        <div className="p-4 space-y-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="aspect-video w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </SecondaryPageLayout>
    )
  }

  if (!liveEvent || !decodedEvent) {
    return (
      <SecondaryPageLayout ref={ref} index={index} title={t('Live Stream')}>
        <div className="p-4 text-center text-muted-foreground">
          {t('Live stream not found')}
        </div>
      </SecondaryPageLayout>
    )
  }

  const title = liveEvent.tags.find(t => t[0] === 'title')?.[1] || t('Untitled Live Stream')
  const summary = liveEvent.tags.find(t => t[0] === 'summary')?.[1]
  const image = liveEvent.tags.find(t => t[0] === 'image')?.[1]
  const streamingUrl = liveEvent.tags.find(t => t[0] === 'streaming')?.[1]
  const currentParticipants = liveEvent.tags.find(t => t[0] === 'current_participants')?.[1]
  const status = liveEvent.tags.find(t => t[0] === 'status')?.[1]

  return (
    <SecondaryPageLayout ref={ref} index={index} title={title} displayScrollToTopButton>
      <div className="max-w-4xl mx-auto">
        {/* Stream Info */}
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
                  <span>{currentParticipants} {t('watching')}</span>
                </div>
              )}
            </div>
          </div>

          {summary && (
            <p className="text-sm text-muted-foreground">{summary}</p>
          )}

          {streamingUrl && (
            <div className="aspect-video bg-black rounded-lg overflow-hidden">
              <video
                src={streamingUrl}
                controls
                autoPlay
                className="w-full h-full"
              />
            </div>
          )}

          {image && !streamingUrl && (
            <img src={image} alt={title} className="w-full rounded-lg" />
          )}

          {/* Zap Button */}
          <div className="flex gap-2">
            <Button onClick={zapLiveEvent} size="sm" variant="outline">
              <ZapIcon className="w-4 h-4 mr-2 text-yellow-500" />
              {t('Zap Stream')}
            </Button>
          </div>
        </div>

        {/* Zaps Display */}
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
                  <span className="text-sm font-semibold text-yellow-500">
                    {formatAmount(zap.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Chat Section */}
        <div className="p-4 space-y-4">
          <h3 className="font-semibold">{t('Live Chat')} ({chatMessages.length})</h3>

          {/* Chat Messages */}
          <div className="space-y-3 max-h-96 overflow-y-auto scrollbar-thin">
            {chatMessages.map((msg) => (
              <ChatMessage key={msg.id} event={msg} isSmallScreen={isSmallScreen} />
            ))}
            <div ref={chatEndRef} />

            {chatMessages.length === 0 && (
              <div className="text-center text-sm text-muted-foreground py-8">
                {t('No messages yet. Be the first to chat!')}
              </div>
            )}
          </div>

          {/* Message Input */}
          <div className="flex gap-2">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t('Type a message...')}
              className="resize-none"
              rows={2}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
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
      </div>
    </SecondaryPageLayout>
  )
})

LiveStreamPage.displayName = 'LiveStreamPage'
export default LiveStreamPage

// Chat Message Component
function ChatMessage({ event, isSmallScreen }: { event: Event; isSmallScreen: boolean }) {
  const { t } = useTranslation()
  const { push } = useSecondaryPage()

  const handleZapMessage = () => {
    modalManager.openZapDialog({ event })
  }

  const handleReact = async () => {
    // TODO: Implement reaction
  }

  return (
    <div className="flex gap-2 group hover:bg-accent/50 p-2 rounded-lg transition-colors">
      <UserAvatar
        userId={event.pubkey}
        size="small"
        className="shrink-0 mt-0.5 cursor-pointer"
        onClick={() => push(`/users/${nip19.npubEncode(event.pubkey)}`)}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <Username
            userId={event.pubkey}
            className="text-sm font-semibold cursor-pointer hover:underline"
            onClick={() => push(`/users/${nip19.npubEncode(event.pubkey)}`)}
          />
          <FormattedTimestamp
            timestamp={event.created_at}
            className="text-xs text-muted-foreground"
            short={isSmallScreen}
          />
        </div>
        <Content content={event.content} className="text-sm mt-0.5" />

        {/* Message Actions */}
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
