import Username from '@/components/Username'
import UserAvatar from '@/components/UserAvatar'
import { FormattedTimestamp } from '@/components/FormattedTimestamp'
import { SecondaryPageLink } from '@/PageManager'
import { toArticle } from '@/lib/link'
import { NostrEvent } from 'nostr-tools'
import { useMemo, useState, useEffect } from 'react'
import { nip19 } from 'nostr-tools'
import localStorageService from '@/services/local-storage.service'
import { useTextOnlyMode } from '@/providers/TextOnlyModeProvider'
import { useMuteList } from '@/providers/MuteListProvider'
import { useFetchProfile } from '@/hooks'
import { hasMutedHashtag, isFromMutedDomain, isMentioningMutedUsers } from '@/lib/event'
import { useContentPolicy } from '@/providers/ContentPolicyProvider'
import { useTranslation } from 'react-i18next'

export default function ArticleCard({ event }: { event: NostrEvent }) {
  const { t } = useTranslation()
  const { textOnlyMode } = useTextOnlyMode()
  const [shouldShowImage, setShouldShowImage] = useState(true)
  const [isRead, setIsRead] = useState(false)
  const { mutePubkeySet, getMutedDomains, getMutedWords, getMutedTags } = useMuteList()
  const { profile, isFetching } = useFetchProfile(event.pubkey)
  const { hideContentMentioningMutedUsers } = useContentPolicy()
  const mutedDomains = getMutedDomains()
  const mutedWords = useMemo(() => getMutedWords(), [getMutedWords])
  const mutedTags = useMemo(() => getMutedTags(), [getMutedTags])

  const { title, summary, image, publishedAt, identifier } = useMemo(() => {
    const titleTag = event.tags.find((tag) => tag[0] === 'title')
    const summaryTag = event.tags.find((tag) => tag[0] === 'summary')
    const imageTag = event.tags.find((tag) => tag[0] === 'image')
    const publishedAtTag = event.tags.find((tag) => tag[0] === 'published_at')
    const dTag = event.tags.find((tag) => tag[0] === 'd')

    return {
      title: titleTag?.[1] || t('Untitled'),
      summary: summaryTag?.[1] || '',
      image: imageTag?.[1],
      publishedAt: publishedAtTag?.[1] ? parseInt(publishedAtTag[1]) : event.created_at,
      identifier: dTag?.[1] || ''
    }
  }, [event])

  // Check if the image URL returns an error status
  useEffect(() => {
    if (!image) {
      setShouldShowImage(false)
      return
    }

    // Make a HEAD request to check the status
    fetch(image, { method: 'HEAD' })
      .then((response) => {
        // Check for x-status header or HTTP status
        const xStatus = response.headers.get('x-status')
        if (xStatus && parseInt(xStatus) >= 400) {
          setShouldShowImage(false)
        } else if (!response.ok) {
          setShouldShowImage(false)
        } else {
          setShouldShowImage(true)
        }
      })
      .catch(() => {
        // If fetch fails, don't show the image
        setShouldShowImage(false)
      })
  }, [image])

  const naddr = useMemo(() => {
    const dTag = event.tags.find((tag) => tag[0] === 'd')
    if (!dTag) return ''

    return nip19.naddrEncode({
      kind: 30023,
      pubkey: event.pubkey,
      identifier: dTag[1],
      relays: []
    })
  }, [event])

  // Check if article has been read
  useEffect(() => {
    setIsRead(localStorageService.isArticleRead(event.id))
  }, [event.id])

  // Extract first 200 chars from content if no summary
  const displaySummary = useMemo(() => {
    if (summary) return summary

    // Remove markdown formatting for preview
    const plainText = event.content
      .replace(/[#*_~`]/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .trim()

    return plainText.length > 200
      ? plainText.slice(0, 200) + '...'
      : plainText
  }, [summary, event.content])

  // Check if the article should be hidden due to muting
  const shouldHide = useMemo(() => {
    // Check if author is muted by pubkey
    if (mutePubkeySet.has(event.pubkey)) {
      return true
    }

    // Check if author is muted by NIP-05 domain
    if (profile && isFromMutedDomain(profile.nip05, mutedDomains)) {
      return true
    }

    // Check if content mentions muted users
    if (hideContentMentioningMutedUsers && isMentioningMutedUsers(event, mutePubkeySet)) {
      return true
    }

    if (mutedTags.length > 0 && hasMutedHashtag(event, mutedTags)) {
      return true
    }

    // Check for muted words in title, summary, content, and username
    if (mutedWords.length > 0) {
      const titleLower = title.toLowerCase()
      const summaryLower = summary.toLowerCase()
      const contentLower = event.content.toLowerCase()
      const username = profile?.username?.toLowerCase() || ''

      if (mutedWords.some(word => {
        const wordLower = word.toLowerCase()
        return titleLower.includes(wordLower) ||
               summaryLower.includes(wordLower) ||
               contentLower.includes(wordLower) ||
               username.includes(wordLower)
      })) {
        return true
      }
    }

    return false
  }, [event, mutePubkeySet, mutedWords, mutedDomains, mutedTags, profile, hideContentMentioningMutedUsers, title, summary])

  // If we have muted domains configured and profile is still loading, wait for profile to load
  if (mutedDomains.length > 0 && isFetching) {
    return null
  }

  // Hide the article if it should be muted
  if (shouldHide) {
    return null
  }

  const handleClick = () => {
    // Mark article as read when clicked
    localStorageService.markArticleAsRead(event.id)
    setIsRead(true)
  }

  return (
    <SecondaryPageLink to={toArticle(naddr)} onClick={handleClick}>
      <div className="py-4 px-4 hover:bg-accent/50 transition-colors cursor-pointer border-b border-border">
        <div className="flex gap-4">
          <div className="flex-1 min-w-0">
            <h3 className={`font-bold text-lg mb-1 line-clamp-2 ${isRead ? 'text-muted-foreground' : ''}`}>{title}</h3>
            {displaySummary && (
              <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                {displaySummary}
              </p>
            )}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>By</span>
              <UserAvatar userId={event.pubkey} size="small" />
              <Username userId={event.pubkey} />
              <span>•</span>
              <FormattedTimestamp timestamp={publishedAt} />
            </div>
          </div>
          {!textOnlyMode && image && shouldShowImage && (
            <div className="flex-shrink-0 w-32 h-24 rounded-lg overflow-hidden bg-muted">
              <img
                src={image}
                alt={title}
                className="w-full h-full object-cover"
                loading="lazy"
                onError={() => setShouldShowImage(false)}
              />
            </div>
          )}
        </div>
      </div>
    </SecondaryPageLink>
  )
}
