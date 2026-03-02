import { Button } from '@/components/ui/button'
import { useAI } from '@/providers/AIProvider'
import { useFetchWebMetadata } from '@/hooks/useFetchWebMetadata'
import Image from '@/components/Image'
import { ArrowRight, Loader2, ExternalLink } from 'lucide-react'
import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Event } from 'nostr-tools'

export type WebCommandListProps = {
  command: (props: { text: string }) => void
  query: string
  parentEvent?: Event
}

export type WebCommandListHandle = {
  onKeyDown: ({ event }: { event: KeyboardEvent }) => boolean
}

type WebSearchResult = {
  answer: string
  urls: string[]
}

const WebCommandList = forwardRef<WebCommandListHandle, WebCommandListProps>((props, ref) => {
  const { t } = useTranslation()
  const { chat, isConfigured, serviceConfig } = useAI()
  const [result, setResult] = useState<WebSearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [submitted, setSubmitted] = useState(false)
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null)

  // Fetch metadata for the first URL if available
  const firstUrl = result?.urls?.[0] || null
  const { title, description, image } = useFetchWebMetadata(selectedUrl || firstUrl || '')

  const hostname = useMemo(() => {
    const url = selectedUrl || firstUrl
    if (!url) return ''
    try {
      return new URL(url).hostname
    } catch {
      return ''
    }
  }, [selectedUrl, firstUrl])

  const handleSubmit = async () => {
    if (!props.query || props.query.trim().length === 0) {
      return
    }

    if (!isConfigured) {
      setError(t('AI is not configured. Please configure it in settings.'))
      return
    }

    if (!serviceConfig.webSearchModel) {
      setError(t('Web search model is not configured. Please select a web search model in AI settings.'))
      return
    }

    setSubmitted(true)
    setLoading(true)
    setError('')
    setResult(null)

    try {
      let userPrompt = props.query

      // If we have a parent event (replying to a note), include its content as context
      if (props.parentEvent) {
        const parentContent = props.parentEvent.content
        userPrompt = `Context (the note I'm replying to): "${parentContent}"\n\nMy search query: ${props.query}`
      }

      // Use the web search model with a specific system prompt
      const systemPrompt = `You are a web search assistant. Your task is to search the web and provide:
1. A concise answer to the user's query (2-3 sentences max)
2. A list of relevant URLs (up to 3 most relevant sources)

Format your response as JSON with this exact structure:
{
  "answer": "Your concise answer here",
  "urls": ["https://url1.com", "https://url2.com", "https://url3.com"]
}

Be sure to include only the most relevant and authoritative sources.`

      // Use the web search model from config
      const tempConfig = { ...serviceConfig, model: serviceConfig.webSearchModel }
      const previousConfig = { ...serviceConfig }

      // Temporarily set the web search model
      const aiService = (await import('@/services/ai.service')).default
      aiService.setConfig(tempConfig)

      const response = await chat([
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: userPrompt
        }
      ])

      // Restore previous config
      aiService.setConfig(previousConfig)

      console.log('Web search raw response:', response)

      // Parse the JSON response - try to find JSON block
      let parsed: WebSearchResult | null = null

      // First, try to parse the entire response as JSON
      try {
        parsed = JSON.parse(response) as WebSearchResult
      } catch {
        // If that fails, try to extract JSON from markdown code blocks
        const codeBlockMatch = response.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
        if (codeBlockMatch) {
          try {
            parsed = JSON.parse(codeBlockMatch[1]) as WebSearchResult
          } catch {
            // Continue to next attempt
          }
        }

        // If still no match, try to find any JSON object in the response
        if (!parsed) {
          const jsonMatch = response.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            try {
              parsed = JSON.parse(jsonMatch[0]) as WebSearchResult
            } catch {
              // Continue to error
            }
          }
        }
      }

      if (!parsed) {
        console.error('Failed to parse web search response:', response)
        throw new Error('Invalid response format from web search')
      }

      // Validate the response
      if (!parsed.answer || !Array.isArray(parsed.urls)) {
        console.error('Invalid web search result structure:', parsed)
        throw new Error('Invalid web search result structure')
      }

      setResult(parsed)
    } catch (err: any) {
      console.error('Web Search Error:', err)
      setError(err.message || t('Failed to perform web search'))
    } finally {
      setLoading(false)
    }
  }

  // Reset submitted state when query changes
  useEffect(() => {
    setSubmitted(false)
    setResult(null)
    setError('')
    setSelectedUrl(null)
  }, [props.query])

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        if (result && !loading) {
          // Insert the answer and first URL
          const textToInsert = `${result.answer}\n\n${result.urls[0]}`
          props.command({ text: textToInsert })
        } else if (props.query && !loading && !submitted) {
          // Submit the query if we haven't submitted yet
          handleSubmit()
        }
        return true
      }
      return false
    }
  }))

  // Show prompt input helper if no query yet
  if (!props.query || props.query.trim().length === 0) {
    return (
      <div className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
        {t('Type your search query...')}
      </div>
    )
  }

  if (!isConfigured) {
    return (
      <div className="border rounded-lg bg-background z-50 pointer-events-auto p-2 max-w-md">
        <p className="text-xs text-destructive">
          {t('AI is not configured. Please configure it in settings.')}
        </p>
      </div>
    )
  }

  if (!serviceConfig.webSearchModel) {
    return (
      <div className="border rounded-lg bg-background z-50 pointer-events-auto p-2 max-w-md">
        <p className="text-xs text-destructive">
          {t('Web search model is not configured. Please select a web search model in AI settings.')}
        </p>
      </div>
    )
  }

  // Show submit button if not yet submitted
  if (!submitted) {
    return (
      <div className="inline-flex items-center gap-2 z-50 pointer-events-auto">
        <Button
          size="sm"
          onClick={(e) => {
            e.stopPropagation()
            handleSubmit()
          }}
          disabled={loading}
          className="h-7 w-7 rounded-full p-0"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ArrowRight className="h-3.5 w-3.5" />
          )}
        </Button>
        <span className="text-xs text-muted-foreground">
          {t('Press Enter or click to search')}
        </span>
      </div>
    )
  }

  // Show loading state
  if (loading) {
    return (
      <div className="inline-flex items-center gap-2 bg-muted px-3 py-1.5 rounded-full z-50 pointer-events-auto">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span className="text-xs text-muted-foreground">
          {t('Searching the web...')}
        </span>
      </div>
    )
  }

  // Show error state
  if (error) {
    return (
      <div className="border rounded-lg bg-background z-50 pointer-events-auto p-2 max-w-md">
        <p className="text-xs text-destructive">{error}</p>
      </div>
    )
  }

  // Show result with rich card preview
  if (result) {
    return (
      <div className="border rounded-lg bg-background z-50 pointer-events-auto p-3 max-w-2xl space-y-3">
        <div className="text-xs text-muted-foreground mb-2">{t('Web Search Results:')}</div>

        {/* Answer Section */}
        <div className="bg-muted p-3 rounded-lg">
          <div className="text-sm font-medium mb-1">{t('Answer:')}</div>
          <div className="text-sm whitespace-pre-wrap">{result.answer}</div>
        </div>

        {/* Source Links */}
        {result.urls.length > 0 && (
          <div>
            <div className="text-sm font-medium mb-2">{t('Sources:')}</div>
            <div className="space-y-2">
              {result.urls.map((url, idx) => (
                <button
                  key={idx}
                  className="w-full text-left p-2 border rounded-lg hover:bg-accent transition-colors flex items-center gap-2"
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedUrl(url)
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation()
                    window.open(url, '_blank')
                  }}
                >
                  <ExternalLink className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-muted-foreground truncate">{url}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Link Preview Card (if we have metadata for selected or first URL) */}
        {(selectedUrl || firstUrl) && title && (
          <div className="border-t pt-3">
            <div className="text-sm font-medium mb-2">{t('Preview:')}</div>
            <div
              className="p-2 flex gap-2 w-full border rounded-lg overflow-hidden cursor-pointer hover:bg-accent transition-colors"
              onClick={(e) => {
                e.stopPropagation()
                window.open(selectedUrl || firstUrl || '', '_blank')
              }}
            >
              {image && (
                <Image image={{ url: image }} className="w-16 h-16 rounded flex-shrink-0" hideIfError />
              )}
              <div className="flex-1 min-w-0">
                <div className="font-semibold line-clamp-2 text-sm">{title}</div>
                {description && (
                  <div className="text-xs text-muted-foreground line-clamp-2 mt-1">{description}</div>
                )}
                <div className="text-xs text-muted-foreground mt-1">{hostname}</div>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 border-t pt-3">
          <Button
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              const textToInsert = `${result.answer}\n\n${result.urls.join('\n')}`
              props.command({ text: textToInsert })
            }}
            className="flex-1"
          >
            {t('Insert All')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation()
              props.command({ text: result.answer })
            }}
          >
            {t('Answer Only')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation()
              const textToInsert = `${result.answer}\n\n${result.urls.join('\n')}`
              navigator.clipboard.writeText(textToInsert)
            }}
          >
            {t('Copy')}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {t('Press Enter to insert answer and first link')}
        </p>
      </div>
    )
  }

  return null
})

WebCommandList.displayName = 'WebCommandList'
export default WebCommandList
