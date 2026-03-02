import { useTranslationService } from '@/providers/TranslationServiceProvider'
import { Event } from 'nostr-tools'
import { useState } from 'react'
import { Loader } from 'lucide-react'
import { toast } from 'sonner'
import { toTranslation } from '@/lib/link'
import { useSecondaryPage } from '@/PageManager'

export default function ShowTranslatedButton({
  event,
  className
}: {
  event: Event
  className?: string
}) {
  const { push } = useSecondaryPage()
  const { translateEvent, getTranslatedEvent } = useTranslationService()
  const [translating, setTranslating] = useState(false)
  
  // Check if translation exists in cache
  const translatedEvent = getTranslatedEvent(event.id)
  
  if (!translatedEvent) {
    return null
  }

  const handleShowTranslated = async () => {
    if (translating) return

    setTranslating(true)
    await translateEvent(event)
      .catch((error) => {
        toast.error(
          'Translation failed: ' + (error.message || 'An error occurred while translating the note')
        )
        if (error.message === 'Insufficient balance.') {
          push(toTranslation())
        }
      })
      .finally(() => {
        setTranslating(false)
      })
  }

  return (
    <div className={className}>
      <p className="text-xs text-muted-foreground">
        {translating ? (
          <span className="flex items-center gap-1">
            <Loader className="animate-spin w-3 h-3" />
            Translating...
          </span>
        ) : (
          <>
            Viewing original.{' '}
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleShowTranslated()
              }}
              className="text-primary hover:underline"
            >
              Show translated
            </button>
          </>
        )}
      </p>
    </div>
  )
}
