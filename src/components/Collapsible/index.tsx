import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useCollapseLongNotes } from '@/providers/CollapseLongNotesProvider'
import { useAlwaysShowFullMedia } from '@/providers/AlwaysShowFullMediaProvider'

export default function Collapsible({
  alwaysExpand = false,
  children,
  className,
  threshold = 1000,
  collapsedHeight = 600,
  hasMedia = false,
  ...props
}: {
  alwaysExpand?: boolean
  threshold?: number
  collapsedHeight?: number
  hasMedia?: boolean
} & React.HTMLProps<HTMLDivElement>) {
  const { t } = useTranslation()
  const { collapseLongNotes } = useCollapseLongNotes()
  const { alwaysShowFullMedia } = useAlwaysShowFullMedia()
  const containerRef = useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [shouldCollapse, setShouldCollapse] = useState(false)

  useEffect(() => {
    // Don't collapse if:
    // - alwaysExpand is true
    // - user disabled collapsing long notes
    // - content has media and user enabled always show full media
    const shouldNotCollapse = alwaysExpand || !collapseLongNotes || (hasMedia && alwaysShowFullMedia)

    if (shouldNotCollapse || shouldCollapse) return

    const contentEl = containerRef.current
    if (!contentEl) return

    const checkHeight = () => {
      const fullHeight = contentEl.scrollHeight
      if (fullHeight > threshold) {
        setShouldCollapse(true)
      }
    }

    checkHeight()

    const observer = new ResizeObserver(() => {
      checkHeight()
    })

    observer.observe(contentEl)

    return () => {
      observer.disconnect()
    }
  }, [alwaysExpand, shouldCollapse, collapseLongNotes, hasMedia, alwaysShowFullMedia, threshold])

  return (
    <div
      className={cn('relative text-left overflow-hidden', className)}
      ref={containerRef}
      {...props}
      style={{
        maxHeight: !shouldCollapse || expanded ? 'none' : `${collapsedHeight}px`
      }}
    >
      {children}
      {shouldCollapse && !expanded && (
        <div className="absolute bottom-0 h-40 w-full bg-gradient-to-b from-transparent to-background/90 flex items-end justify-center pb-4">
          <div
            className="bg-secondary"
            style={{ borderRadius: 'var(--button-radius, 6px)' }}
          >
            <Button
              onClick={(e) => {
                e.stopPropagation()
                setExpanded(!expanded)
              }}
            >
              {t('Show more')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
