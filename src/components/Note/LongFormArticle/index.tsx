import { SecondaryPageLink, useSecondaryPage } from '@/PageManager'
import ImageWithLightbox from '@/components/ImageWithLightbox'
import { getLongFormArticleMetadataFromEvent } from '@/lib/event-metadata'
import { toNote, toNoteList, toProfile } from '@/lib/link'
import { ExternalLink } from 'lucide-react'
import { Event, kinds } from 'nostr-tools'
import { useMemo } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import NostrNode from './NostrNode'
import { remarkNostr } from './remarkNostr'
import { Components } from './types'
import { useTextOnlyMode } from '@/providers/TextOnlyModeProvider'
import { useMediaStyle } from '@/providers/MediaStyleProvider'
import { MEDIA_STYLE } from '@/constants'

export default function LongFormArticle({
  event,
  className
}: {
  event: Event
  className?: string
}) {
  const { push } = useSecondaryPage()
  const { textOnlyMode } = useTextOnlyMode()
  const { mediaStyle } = useMediaStyle()
  const isFullWidth = mediaStyle === MEDIA_STYLE.FULL_WIDTH
  const metadata = useMemo(() => getLongFormArticleMetadataFromEvent(event), [event])

  const components = useMemo(
    () =>
      ({
        nostr: ({ rawText, bech32Id }) => <NostrNode rawText={rawText} bech32Id={bech32Id} />,
        a: ({ href, children, ...props }) => {
          if (!href) {
            return <span {...props} className="break-words" />
          }
          if (href.startsWith('note1') || href.startsWith('nevent1') || href.startsWith('naddr1')) {
            return (
              <SecondaryPageLink
                to={toNote(href)}
                className="break-words underline text-foreground"
              >
                {children}
              </SecondaryPageLink>
            )
          }
          if (href.startsWith('npub1') || href.startsWith('nprofile1')) {
            return (
              <SecondaryPageLink
                to={toProfile(href)}
                className="break-words underline text-foreground"
              >
                {children}
              </SecondaryPageLink>
            )
          }
          return (
            <a
              {...props}
              href={href}
              target="_blank"
              rel="noreferrer noopener"
              className="break-words inline-flex items-baseline gap-1"
            >
              {children} <ExternalLink className="size-3" />
            </a>
          )
        },
        h1: (props) => <h1 {...props} className="break-words" />,
        h2: (props) => <h2 {...props} className="break-words" />,
        h3: (props) => <h3 {...props} className="break-words" />,
        h4: (props) => <h4 {...props} className="break-words" />,
        h5: (props) => <h5 {...props} className="break-words" />,
        h6: (props) => <h6 {...props} className="break-words" />,
        p: (props) => <p {...props} className="break-words" />,
        div: (props) => <div {...props} className="break-words" />,
        ul: (props) => <ul {...props} className="break-words" />,
        ol: (props) => <ol {...props} className="break-words" />,
        li: (props) => <li {...props} className="break-words" />,
        blockquote: (props) => <blockquote {...props} className="break-words" />,
        pre: (props) => <pre {...props} className="break-words overflow-x-auto" />,
        code: (props) => <code {...props} className="break-words whitespace-pre-wrap" />,
        table: (props) => <table {...props} className="break-words" />,
        thead: (props) => <thead {...props} className="break-words" />,
        tbody: (props) => <tbody {...props} className="break-words" />,
        tr: (props) => <tr {...props} className="break-words" />,
        td: (props) => <td {...props} className="break-words" />,
        th: (props) => <th {...props} className="break-words" />,
        img: function ImageComponent(props) {
          const imageUrl = props.src || ''
          if (textOnlyMode) {
            return (
              <span className="inline-flex items-center rounded-full border border-border/60 text-muted-foreground text-xs px-2 py-0.5 my-2">
                Image hidden
              </span>
            )
          }
          return (
            <ImageWithLightbox
              image={{ url: imageUrl, pubkey: event.pubkey }}
              className={isFullWidth ? 'object-contain my-0' : 'max-h-[80vh] sm:max-h-[50vh] object-contain my-0'}
              classNames={{
                wrapper: isFullWidth ? 'w-full' : 'w-fit max-w-full'
              }}
            />
          )
        }
      }) as Components,
    [event.pubkey, textOnlyMode, isFullWidth]
  )

  return (
    <div
      className={`prose prose-zinc max-w-none dark:prose-invert break-words overflow-wrap-anywhere ${className || ''}`}
    >
      <h1 className="break-words">{metadata.title}</h1>
      {metadata.summary && (
        <blockquote>
          <p className="break-words">{metadata.summary}</p>
        </blockquote>
      )}
      {metadata.image && (
        <ImageWithLightbox
          image={{ url: metadata.image, pubkey: event.pubkey }}
          className="w-full aspect-[3/1] object-cover my-0"
        />
      )}
      <Markdown
        remarkPlugins={[remarkGfm, remarkNostr]}
        urlTransform={(url) => {
          if (url.startsWith('nostr:')) {
            return url.slice(6) // Remove 'nostr:' prefix for rendering
          }
          return url
        }}
        components={components}
      >
        {event.content}
      </Markdown>
      {metadata.tags.length > 0 && (
        <div className="flex gap-2 flex-wrap pb-2">
          {metadata.tags.map((tag) => (
            <div
              key={tag}
              title={tag}
              className="flex items-center rounded-full px-3 bg-muted text-muted-foreground max-w-44 cursor-pointer hover:bg-accent hover:text-accent-foreground"
              onClick={(e) => {
                e.stopPropagation()
                push(toNoteList({ hashtag: tag, kinds: [kinds.LongFormArticle] }))
              }}
            >
              #<span className="truncate">{tag}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
