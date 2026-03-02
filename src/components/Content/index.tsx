import { useTranslatedEvent } from '@/hooks'
import {
  EmbeddedEmojiParser,
  EmbeddedEventParser,
  EmbeddedHashtagParser,
  EmbeddedLNInvoiceParser,
  EmbeddedMentionParser,
  EmbeddedUrlParser,
  EmbeddedWebsocketUrlParser,
  parseContent
} from '@/lib/content-parser'
import { getImetaInfosFromEvent } from '@/lib/event'
import { getEmojiInfosFromEmojiTags, getImetaInfoFromImetaTag } from '@/lib/tag'
import { cn, detectLanguage } from '@/lib/utils'
import mediaUpload from '@/services/media-upload.service'
import { TImetaInfo } from '@/types'
import { Event } from 'nostr-tools'
import { useEffect, useMemo, useState } from 'react'
import {
  EmbeddedHashtag,
  EmbeddedLNInvoice,
  EmbeddedMention,
  EmbeddedNormalUrl,
  EmbeddedNote,
  EmbeddedWebsocketUrl
} from '../Embedded'
import Emoji from '../Emoji'
import ImageGallery from '../ImageGallery'
import MediaPlayer from '../MediaPlayer'
import WebPreview from '../WebPreview'
import YoutubeEmbeddedPlayer from '../YoutubeEmbeddedPlayer'
import TranslationIndicator from '../TranslationIndicator'
import ShowTranslatedButton from '../ShowTranslatedButton'
import { useTranslationService } from '@/providers/TranslationServiceProvider'
import { useTextOnlyMode } from '@/providers/TextOnlyModeProvider'
import { useTranslation } from 'react-i18next'
import { ExtendedKind } from '@/constants'
import { kinds } from 'nostr-tools'

export default function Content({
  event,
  content,
  className,
  mustLoadMedia,
  compactMedia = false
}: {
  event?: Event
  content?: string
  className?: string
  mustLoadMedia?: boolean
  compactMedia?: boolean
}) {
  const { textOnlyMode } = useTextOnlyMode()
  const [loadedMedia, setLoadedMedia] = useState<Set<string>>(new Set())
  const translatedEvent = useTranslatedEvent(event?.id)
  const { autoTranslateEvent, shouldAutoTranslate } = useTranslationService()
  const { i18n } = useTranslation()

  const handleLoadMedia = (url: string) => {
    setLoadedMedia((prev) => new Set(prev).add(url))
  }

  // Auto-translate effect
  useEffect(() => {
    if (!event || !shouldAutoTranslate()) {
      return
    }

    // Check if content needs translation
    const supported = [
      kinds.ShortTextNote,
      kinds.Highlights,
      ExtendedKind.COMMENT,
      ExtendedKind.PICTURE,
      ExtendedKind.POLL,
      ExtendedKind.RELAY_REVIEW
    ].includes(event.kind)

    if (!supported) {
      return
    }

    const detected = detectLanguage(event.content)
    if (!detected) return

    // Don't translate if already in target language
    if (detected !== 'und' && i18n.language.startsWith(detected)) {
      return
    }

    // Trigger auto-translation
    autoTranslateEvent(event)
  }, [event, shouldAutoTranslate, autoTranslateEvent, i18n.language])

  const { nodes, allImages, lastNormalUrl, emojiInfos, totalMediaCount } = useMemo(() => {
    const _content = translatedEvent?.content ?? event?.content ?? content
    if (!_content) return {}

    const nodes = parseContent(_content, [
      EmbeddedUrlParser,
      EmbeddedLNInvoiceParser,
      EmbeddedWebsocketUrlParser,
      EmbeddedEventParser,
      EmbeddedMentionParser,
      EmbeddedHashtagParser,
      EmbeddedEmojiParser
    ])

    const imetaInfos = event ? getImetaInfosFromEvent(event) : []
    const allImages = nodes
      .map((node) => {
        if (node.type === 'image') {
          const imageInfo = imetaInfos.find((image) => image.url === node.data)
          if (imageInfo) {
            return imageInfo
          }
          const tag = mediaUpload.getImetaTagByUrl(node.data)
          return tag
            ? getImetaInfoFromImetaTag(tag, event?.pubkey)
            : { url: node.data, pubkey: event?.pubkey }
        }
        if (node.type === 'images') {
          const urls = Array.isArray(node.data) ? node.data : [node.data]
          return urls.map((url) => {
            const imageInfo = imetaInfos.find((image) => image.url === url)
            return imageInfo ?? { url, pubkey: event?.pubkey }
          })
        }
        return null
      })
      .filter(Boolean)
      .flat() as TImetaInfo[]

    const emojiInfos = getEmojiInfosFromEmojiTags(event?.tags)

    const lastNormalUrlNode = nodes.findLast((node) => node.type === 'url')
    const lastNormalUrl =
      typeof lastNormalUrlNode?.data === 'string' ? lastNormalUrlNode.data : undefined

    // Count total media items (images, videos, youtube)
    const totalMediaCount = nodes.reduce((count, node) => {
      if (node.type === 'image') return count + 1
      if (node.type === 'images') {
        return count + (Array.isArray(node.data) ? node.data.length : 1)
      }
      if (node.type === 'media' || node.type === 'youtube') return count + 1
      return count
    }, 0)

    return { nodes, allImages, emojiInfos, lastNormalUrl, totalMediaCount }
  }, [event, translatedEvent, content])

  if (!nodes || nodes.length === 0) {
    return null
  }

  let imageIndex = 0
  return (
    <div className={cn('text-wrap break-words whitespace-pre-wrap', className)}>
      {event && translatedEvent && <TranslationIndicator event={event} className="mb-2" />}
      {event && !translatedEvent && <ShowTranslatedButton event={event} className="mb-2" />}
      {nodes.map((node, index) => {
        if (node.type === 'text') {
          return node.data
        }
        if (node.type === 'image' || node.type === 'images') {
          const start = imageIndex
          const end = imageIndex + (Array.isArray(node.data) ? node.data.length : 1)
          imageIndex = end

          if (textOnlyMode) {
            const urls = Array.isArray(node.data) ? node.data : [node.data]
            return urls.map((url, i) => {
              const isLoaded = loadedMedia.has(url)
              if (isLoaded) {
                const imageIndex = allImages.findIndex(img => img.url === url)
                if (imageIndex >= 0) {
                  return (
                    <ImageGallery
                      className="mt-2"
                      key={`${index}-${i}`}
                      images={[allImages[imageIndex]]}
                      start={0}
                      end={1}
                      mustLoad={true}
                      compactMedia={compactMedia}
                      isSingleMedia={totalMediaCount <= 2}
                    />
                  )
                }
              }
              return (
                <span key={`${index}-${i}`} className="inline-block mt-1">
                  [image: <button
                    onClick={() => handleLoadMedia(url)}
                    className="text-primary hover:underline"
                  >
                    load
                  </button>]
                </span>
              )
            })
          }

          return (
            <ImageGallery
              className="mt-2"
              key={index}
              images={allImages}
              start={start}
              end={end}
              mustLoad={mustLoadMedia}
              compactMedia={compactMedia}
              isSingleMedia={totalMediaCount <= 2}
            />
          )
        }
        if (node.type === 'media') {
          if (textOnlyMode) {
            const isLoaded = loadedMedia.has(node.data)
            if (isLoaded) {
              return (
                <MediaPlayer className="mt-2" key={index} src={node.data} pubkey={event?.pubkey} mustLoad={true} compactMedia={compactMedia} isSingleMedia={totalMediaCount <= 2} />
              )
            }
            return (
              <span key={index} className="inline-block mt-1">
                [video: <button
                  onClick={() => handleLoadMedia(node.data)}
                  className="text-primary hover:underline"
                >
                  load
                </button>]
              </span>
            )
          }
          return (
            <MediaPlayer className="mt-2" key={index} src={node.data} pubkey={event?.pubkey} mustLoad={mustLoadMedia} compactMedia={compactMedia} isSingleMedia={totalMediaCount <= 2} />
          )
        }
        if (node.type === 'url') {
          return <EmbeddedNormalUrl url={node.data} key={index} />
        }
        if (node.type === 'invoice') {
          return <EmbeddedLNInvoice invoice={node.data} key={index} className="mt-2" />
        }
        if (node.type === 'websocket-url') {
          return <EmbeddedWebsocketUrl url={node.data} key={index} />
        }
        if (node.type === 'event') {
          const id = node.data.split(':')[1]
          return <EmbeddedNote key={index} noteId={id} className="mt-2" />
        }
        if (node.type === 'mention') {
          return <EmbeddedMention key={index} userId={node.data.split(':')[1]} />
        }
        if (node.type === 'hashtag') {
          return <EmbeddedHashtag hashtag={node.data} key={index} />
        }
        if (node.type === 'emoji') {
          const shortcode = node.data.split(':')[1]
          const emoji = emojiInfos.find((e) => e.shortcode === shortcode)
          if (!emoji) return node.data
          return <Emoji classNames={{ img: 'mb-1' }} emoji={emoji} key={index} />
        }
        if (node.type === 'youtube') {
          if (textOnlyMode) {
            const isLoaded = loadedMedia.has(node.data)
            if (isLoaded) {
              return (
                <YoutubeEmbeddedPlayer
                  key={index}
                  url={node.data}
                  pubkey={event?.pubkey}
                  className="mt-2"
                  mustLoad={true}
                  isSingleMedia={totalMediaCount <= 2}
                />
              )
            }
            return (
              <span key={index} className="inline-block mt-1">
                [video: <button
                  onClick={() => handleLoadMedia(node.data)}
                  className="text-primary hover:underline"
                >
                  load
                </button>]
              </span>
            )
          }
          return (
            <YoutubeEmbeddedPlayer
              key={index}
              url={node.data}
              pubkey={event?.pubkey}
              className="mt-2"
              mustLoad={mustLoadMedia}
              isSingleMedia={totalMediaCount <= 2}
            />
          )
        }
        return null
      })}
      {!textOnlyMode && lastNormalUrl && <WebPreview className="mt-2" url={lastNormalUrl} pubkey={event?.pubkey} />}
    </div>
  )
}
