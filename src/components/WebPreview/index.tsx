import { useFetchWebMetadata } from '@/hooks/useFetchWebMetadata'
import { cn } from '@/lib/utils'
import { useAI } from '@/providers/AIProvider'
import { useContentPolicy } from '@/providers/ContentPolicyProvider'
import { Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import ArticleSummaryDialog from '../ArticleSummaryDialog'
import Image from '../Image'

export default function WebPreview({ url, pubkey, className }: { url: string; pubkey?: string; className?: string }) {
  const { shouldAutoLoadMedia } = useContentPolicy()
  const { isConfigured } = useAI()
  const { title, description, image } = useFetchWebMetadata(url)
  const [showSummary, setShowSummary] = useState(false)

  const hostname = useMemo(() => {
    try {
      return new URL(url).hostname
    } catch {
      return ''
    }
  }, [url])

  const showSummarizeButton = isConfigured
  const autoLoadMedia = shouldAutoLoadMedia(pubkey)

  // Don't show preview if auto-load media is disabled
  if (!autoLoadMedia) {
    return null
  }

  // If we have metadata, show the full card
  if (title) {
    return (
      <>
        <div
          className={cn(
            'p-3 clickable flex gap-3 w-full border overflow-hidden relative group',
            className
          )}
          style={{ borderRadius: 'var(--media-radius, 12px)' }}
          onClick={(e) => {
            e.stopPropagation()
            window.open(url, '_blank')
          }}
        >
          {image && (
            <Image
              image={{ url: image }}
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-md flex-shrink-0"
              hideIfError
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="font-semibold line-clamp-2 text-sm sm:text-base leading-snug">{title}</div>
            {description && (
              <div className="text-xs sm:text-sm text-muted-foreground line-clamp-2 mt-0.5">{description}</div>
            )}
            <div className="text-xs text-muted-foreground mt-1">{hostname}</div>
          </div>

          {/* Summarize Button */}
          {showSummarizeButton && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                e.preventDefault()
                setShowSummary(true)
              }}
              className="absolute top-2 right-2 p-1.5 rounded-md bg-background/80 backdrop-blur-sm border border-border hover:bg-accent hover:text-accent-foreground transition-colors opacity-0 group-hover:opacity-100"
              title="Summarize with AI"
            >
              <Sparkles className="size-4" />
            </button>
          )}
        </div>

        {/* Summary Dialog */}
        {showSummarizeButton && (
          <ArticleSummaryDialog
            url={url}
            title={title}
            description={description ?? undefined}
            open={showSummary}
            onOpenChange={setShowSummary}
          />
        )}
      </>
    )
  }

  // No metadata available - this means proxy is not configured
  // Just return null, the URL is already shown as a clickable link in the content
  return null
}
