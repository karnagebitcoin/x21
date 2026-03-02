import { useSecondaryPage } from '@/PageManager'
import Username from '@/components/Username'
import UserAvatar from '@/components/UserAvatar'
import { FormattedTimestamp } from '@/components/FormattedTimestamp'
import NoteInteractions from '@/components/NoteInteractions'
import NoteStats from '@/components/NoteStats'
import ArticleOptions from '@/components/ArticleOptions'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { useFetchEvent, useFetchProfile } from '@/hooks'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { forwardRef, useMemo, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import { remarkNostrLinks, nostrSanitizeSchema } from '@/lib/markdown'
import { EmbeddedNote } from '@/components/Embedded/EmbeddedNote'
import { nip19 } from 'nostr-tools'
import { useMuteList } from '@/providers/MuteListProvider'
import { useContentPolicy } from '@/providers/ContentPolicyProvider'
import { isFromMutedDomain, isMentioningMutedUsers } from '@/lib/event'

const ArticlePage = forwardRef(({ id, index }: { id?: string; index?: number }, ref) => {
  const { t } = useTranslation()
  const { event, isFetching } = useFetchEvent(id)
  const [shouldShowHeaderImage, setShouldShowHeaderImage] = useState(true)
  const [showMuted, setShowMuted] = useState(false)
  const { mutePubkeySet, getMutedDomains, getMutedWords } = useMuteList()
  const { profile, isFetching: isProfileFetching } = useFetchProfile(event?.pubkey)
  const { hideContentMentioningMutedUsers } = useContentPolicy()
  const mutedDomains = getMutedDomains()
  const mutedWords = useMemo(() => getMutedWords(), [getMutedWords])

  const articleData = useMemo(() => {
    if (!event) return null

    const titleTag = event.tags.find((tag) => tag[0] === 'title')
    const summaryTag = event.tags.find((tag) => tag[0] === 'summary')
    const imageTag = event.tags.find((tag) => tag[0] === 'image')
    const publishedAtTag = event.tags.find((tag) => tag[0] === 'published_at')

    return {
      title: titleTag?.[1] || 'Untitled',
      summary: summaryTag?.[1] || '',
      image: imageTag?.[1],
      publishedAt: publishedAtTag?.[1] ? parseInt(publishedAtTag[1]) : event.created_at,
      content: event.content
    }
  }, [event])

  // Check if the article should be hidden or shown as muted
  const muteStatus = useMemo(() => {
    if (!event) return { shouldHide: false, isMutedByPubkey: false, isMutedByDomain: false }

    // Check if author is muted by pubkey
    const isMutedByPubkey = mutePubkeySet.has(event.pubkey)

    // Check if author is muted by NIP-05 domain
    const isMutedByDomain = profile && isFromMutedDomain(profile.nip05, mutedDomains)

    // Check if content mentions muted users
    const mentionsMuted = hideContentMentioningMutedUsers && isMentioningMutedUsers(event, mutePubkeySet)

    // Check for muted words in title, summary, content, and username
    let containsMutedWords = false
    if (mutedWords.length > 0 && articleData) {
      const titleLower = articleData.title.toLowerCase()
      const summaryLower = articleData.summary.toLowerCase()
      const contentLower = event.content.toLowerCase()
      const username = profile?.username?.toLowerCase() || ''

      containsMutedWords = mutedWords.some(word => {
        const wordLower = word.toLowerCase()
        return titleLower.includes(wordLower) ||
               summaryLower.includes(wordLower) ||
               contentLower.includes(wordLower) ||
               username.includes(wordLower)
      })
    }

    // Domain-muted and mention-muted content is completely hidden
    const shouldHide = isMutedByDomain || mentionsMuted || containsMutedWords

    return { shouldHide, isMutedByPubkey, isMutedByDomain }
  }, [event, mutePubkeySet, mutedWords, mutedDomains, profile, hideContentMentioningMutedUsers, articleData])

  // Check if the header image URL returns an error status
  useEffect(() => {
    if (!articleData?.image) {
      setShouldShowHeaderImage(false)
      return
    }

    // Make a HEAD request to check the status
    fetch(articleData.image, { method: 'HEAD' })
      .then((response) => {
        // Check for x-status header or HTTP status
        const xStatus = response.headers.get('x-status')
        if (xStatus && parseInt(xStatus) >= 400) {
          setShouldShowHeaderImage(false)
        } else if (!response.ok) {
          setShouldShowHeaderImage(false)
        } else {
          setShouldShowHeaderImage(true)
        }
      })
      .catch(() => {
        // If fetch fails, don't show the image
        setShouldShowHeaderImage(false)
      })
  }, [articleData?.image])

  if (!event && isFetching) {
    return (
      <SecondaryPageLayout ref={ref} index={index} title={t('Article')}>
        <div className="px-4 pt-3 max-w-3xl mx-auto">
          <Skeleton className="h-12 w-3/4 mb-4" />
          <div className="flex items-center gap-3 mb-6">
            <Skeleton className="w-10 h-10 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-4 w-32 mb-2" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <Skeleton className="w-full h-64 mb-6" />
          <Skeleton className="w-full h-4 mb-2" />
          <Skeleton className="w-full h-4 mb-2" />
          <Skeleton className="w-2/3 h-4 mb-2" />
        </div>
      </SecondaryPageLayout>
    )
  }

  if (!event || !articleData) {
    return (
      <SecondaryPageLayout ref={ref} index={index} title={t('Article')} displayScrollToTopButton>
        <div className="text-center text-muted-foreground py-12">
          {t('Article not found')}
        </div>
      </SecondaryPageLayout>
    )
  }

  // If we have muted domains configured and profile is still loading, wait for profile to load
  if (mutedDomains.length > 0 && isProfileFetching) {
    return (
      <SecondaryPageLayout ref={ref} index={index} title={t('Article')}>
        <div className="px-4 pt-3 max-w-3xl mx-auto">
          <Skeleton className="h-12 w-3/4 mb-4" />
          <div className="flex items-center gap-3 mb-6">
            <Skeleton className="w-10 h-10 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-4 w-32 mb-2" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        </div>
      </SecondaryPageLayout>
    )
  }

  // Completely hide articles that are domain-muted, mention-muted, or contain muted words
  if (muteStatus.shouldHide) {
    return (
      <SecondaryPageLayout ref={ref} index={index} title={t('Article')} displayScrollToTopButton>
        <div className="text-center text-muted-foreground py-12">
          {t('Article not found')}
        </div>
      </SecondaryPageLayout>
    )
  }

  // Show muted message for pubkey-muted articles (with option to view)
  if (muteStatus.isMutedByPubkey && !showMuted) {
    return (
      <SecondaryPageLayout ref={ref} index={index} title={t('Article')} displayScrollToTopButton>
        <div className="text-center py-12 px-4">
          <div className="text-muted-foreground mb-4">
            {t('You muted this author')}
          </div>
          <Button onClick={() => setShowMuted(true)} variant="outline">
            {t('Show anyway')}
          </Button>
        </div>
      </SecondaryPageLayout>
    )
  }

  return (
    <SecondaryPageLayout
      ref={ref}
      index={index}
      title={t('Article')}
      displayScrollToTopButton
      controls={<ArticleOptions event={event} />}
    >
      <article className="px-4 pt-3 pb-8 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-6 select-text">{articleData.title}</h1>

        <div className="flex items-center gap-3 mb-6">
          <UserAvatar userId={event.pubkey} className="w-10 h-10" />
          <div className="flex-1">
            <Username userId={event.pubkey} className="font-semibold" />
            <div className="text-sm text-muted-foreground">
              <FormattedTimestamp timestamp={articleData.publishedAt} />
            </div>
          </div>
        </div>

        {articleData.summary && (
          <p className="text-lg text-muted-foreground mb-6 italic select-text">
            {articleData.summary}
          </p>
        )}

        {articleData.image && shouldShowHeaderImage && (
          <div className="mb-8 rounded-lg overflow-hidden">
            <img
              src={articleData.image}
              alt={articleData.title}
              className="w-full h-auto"
              loading="lazy"
              onError={() => setShouldShowHeaderImage(false)}
            />
          </div>
        )}

        <div className="prose prose-lg dark:prose-invert max-w-none select-text">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkNostrLinks]}
            rehypePlugins={[rehypeRaw, [rehypeSanitize, nostrSanitizeSchema]]}
            components={{
              a: ({ node, href, children, ...props }) => {
                // Check if this is a Nostr note link
                if (href?.startsWith('#/note/')) {
                  const noteId = href.replace('#/note/', '')

                  // Check if it's a note1, nevent1, or naddr1 identifier
                  if (noteId.startsWith('note1') || noteId.startsWith('nevent1') || noteId.startsWith('naddr1')) {
                    try {
                      // Decode to validate it's a proper note identifier
                      const decoded = nip19.decode(noteId)

                      if (decoded.type === 'note' || decoded.type === 'nevent' || decoded.type === 'naddr') {
                        // Render as embedded note
                        return (
                          <div className="my-6 not-prose">
                            <EmbeddedNote noteId={noteId} />
                          </div>
                        )
                      }
                    } catch (e) {
                      console.error('Failed to decode note identifier:', e)
                    }
                  }
                }

                // Regular link handling
                const isExternal = href?.startsWith('http')
                return (
                  <a
                    {...props}
                    href={href}
                    target={isExternal ? "_blank" : undefined}
                    rel={isExternal ? "noopener noreferrer" : undefined}
                    className="text-primary hover:underline break-words"
                  >
                    {children}
                  </a>
                )
              },
              img: ({ node, src, alt, ...props }) => {
                const MarkdownImage = () => {
                  const [shouldShow, setShouldShow] = useState(true)

                  useEffect(() => {
                    if (!src) {
                      setShouldShow(false)
                      return
                    }

                    // Check image status
                    fetch(src, { method: 'HEAD' })
                      .then((response) => {
                        const xStatus = response.headers.get('x-status')
                        if (xStatus && parseInt(xStatus) >= 400) {
                          setShouldShow(false)
                        } else if (!response.ok) {
                          setShouldShow(false)
                        } else {
                          setShouldShow(true)
                        }
                      })
                      .catch(() => {
                        setShouldShow(false)
                      })
                  }, [])

                  if (!shouldShow) return null

                  return (
                    <img
                      {...props}
                      src={src}
                      alt={alt}
                      className="rounded-lg max-w-full h-auto my-4"
                      loading="lazy"
                      onError={() => setShouldShow(false)}
                    />
                  )
                }

                return <MarkdownImage />
              },
              code: ({ node, inline, className, children, ...props }: any) => {
                const match = /language-(\w+)/.exec(className || '')
                return inline ? (
                  <code {...props} className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">
                    {children}
                  </code>
                ) : (
                  <div className="my-4">
                    <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
                      <code className={className} {...props}>
                        {children}
                      </code>
                    </pre>
                  </div>
                )
              },
              pre: ({ node, ...props }) => (
                <pre {...props} />
              ),
              blockquote: ({ node, ...props }) => (
                <blockquote
                  {...props}
                  className="border-l-4 border-primary/50 pl-4 italic my-4 text-muted-foreground"
                />
              ),
              table: ({ node, ...props }) => (
                <div className="overflow-x-auto my-4">
                  <table {...props} className="min-w-full divide-y divide-border" />
                </div>
              ),
              th: ({ node, ...props }) => (
                <th {...props} className="px-4 py-2 text-left font-semibold bg-muted" />
              ),
              td: ({ node, ...props }) => (
                <td {...props} className="px-4 py-2 border-t border-border" />
              ),
              h1: ({ node, ...props }) => (
                <h1 {...props} className="text-2xl font-bold mt-8 mb-4" />
              ),
              h2: ({ node, ...props }) => (
                <h2 {...props} className="text-xl font-bold mt-6 mb-3" />
              ),
              h3: ({ node, ...props }) => (
                <h3 {...props} className="text-lg font-bold mt-5 mb-2" />
              ),
              h4: ({ node, ...props }) => (
                <h4 {...props} className="text-base font-bold mt-4 mb-2" />
              ),
              ul: ({ node, ...props }) => (
                <ul {...props} className="list-disc list-outside ml-6 my-4 space-y-2" />
              ),
              ol: ({ node, ...props }) => (
                <ol {...props} className="list-decimal list-outside ml-6 my-4 space-y-2" />
              ),
              li: ({ node, ...props }) => (
                <li {...props} />
              ),
              p: ({ node, ...props }) => (
                <p {...props} className="my-4 leading-relaxed" />
              ),
              hr: ({ node, ...props }) => (
                <hr {...props} className="my-8 border-border" />
              )
            }}
          >
            {articleData.content}
          </ReactMarkdown>
        </div>

        <div className="mt-8 pt-8 border-t">
          <NoteStats event={event} fetchIfNotExisting displayTopZapsAndLikes />
          <NoteInteractions pageIndex={index} event={event} />
        </div>
      </article>
    </SecondaryPageLayout>
  )
})

ArticlePage.displayName = 'ArticlePage'

export default ArticlePage
