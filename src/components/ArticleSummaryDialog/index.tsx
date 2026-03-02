import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { useAI } from '@/providers/AIProvider'
import { TArticleSummary } from '@/types'
import { Loader2, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function ArticleSummaryDialog({
  url,
  title,
  description,
  open,
  onOpenChange
}: {
  url: string
  title: string
  description?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const { summarizeArticle } = useAI()
  const [summary, setSummary] = useState<TArticleSummary | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open && !summary && !isLoading && !error) {
      generateSummary()
    }
  }, [open])

  const generateSummary = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await summarizeArticle(title, description || '', url)
      setSummary(result)
    } catch (err) {
      console.error('Failed to generate summary:', err)
      setError(err instanceof Error ? err.message : t('Failed to generate summary'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    onOpenChange(false)
    // Reset state when dialog closes
    setTimeout(() => {
      setSummary(null)
      setError(null)
    }, 200)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto scrollbar-hide">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            {t('Article Summary')}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t('AI-generated summary of the article')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Article Title */}
          <div className="border-l-4 border-primary pl-4">
            <h3 className="font-semibold text-lg leading-tight">{title}</h3>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center space-y-3">
                <Loader2 className="size-8 animate-spin mx-auto text-primary" />
                <p className="text-sm text-muted-foreground">{t('Generating summary...')}</p>
              </div>
            </div>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <div className="space-y-4">
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                <p className="text-sm text-destructive">{error}</p>
              </div>
              <Button onClick={generateSummary} variant="outline" className="w-full">
                {t('Retry')}
              </Button>
            </div>
          )}

          {/* Summary Content */}
          {summary && !isLoading && (
            <div className="space-y-6">
              {/* Key Takeaways */}
              {summary.keyTakeaways && summary.keyTakeaways.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-semibold text-base">{t('Key Takeaways')}</h4>
                  <ul className="space-y-2">
                    {summary.keyTakeaways.map((takeaway, index) => (
                      <li key={index} className="flex gap-3">
                        <span className="text-primary mt-1.5 flex-shrink-0">•</span>
                        <span className="text-sm leading-relaxed">{takeaway}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Summary */}
              {summary.summary && (
                <div className="space-y-3">
                  <h4 className="font-semibold text-base">{t('Summary')}</h4>
                  <div className="text-sm leading-relaxed space-y-3">
                    {summary.summary.split('\n\n').map((paragraph, index) => (
                      <p key={index}>{paragraph}</p>
                    ))}
                  </div>
                </div>
              )}

              {/* Source Link */}
              <div className="pt-4 border-t">
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-muted-foreground hover:text-primary hover:underline break-all"
                >
                  {t('Read full article')} →
                </a>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
