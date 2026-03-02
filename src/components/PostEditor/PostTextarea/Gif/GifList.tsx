import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import gifService, { GifData } from '@/services/gif.service'
import { SuggestionKeyDownProps } from '@tiptap/suggestion'
import { Loader2 } from 'lucide-react'
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import { useTranslation } from 'react-i18next'

export interface GifListProps {
  query: string
  command: (payload: { url: string }) => void
  pubkey?: string
}

export interface GifListHandle {
  onKeyDown: (args: SuggestionKeyDownProps) => boolean
}

const GifList = forwardRef<GifListHandle, GifListProps>((props, ref) => {
  const { t } = useTranslation()
  const [selectedIndex, setSelectedIndex] = useState<number>(0)
  const [gifs, setGifs] = useState<GifData[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const loadGifs = async () => {
      setIsLoading(true)
      try {
        const { gifs: results } = await gifService.searchGifs(props.query.trim(), 20, 0)
        setGifs(results)
        setSelectedIndex(0)
      } catch (error) {
        console.error('Error searching GIFs:', error)
        setGifs([])
      } finally {
        setIsLoading(false)
      }
    }

    loadGifs()
  }, [props.query])

  const selectItem = (index: number) => {
    const gif = gifs[index]
    if (gif) {
      props.command({ url: gif.url })
    }
  }

  const upHandler = () => {
    setSelectedIndex((selectedIndex + gifs.length - 1) % gifs.length)
  }

  const downHandler = () => {
    setSelectedIndex((selectedIndex + 1) % gifs.length)
  }

  const leftHandler = () => {
    setSelectedIndex((selectedIndex - 4 + gifs.length) % gifs.length)
  }

  const rightHandler = () => {
    setSelectedIndex((selectedIndex + 4) % gifs.length)
  }

  const enterHandler = () => {
    selectItem(selectedIndex)
  }

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: SuggestionKeyDownProps) => {
      if (event.key === 'ArrowUp') {
        upHandler()
        return true
      }

      if (event.key === 'ArrowDown') {
        downHandler()
        return true
      }

      if (event.key === 'ArrowLeft') {
        leftHandler()
        return true
      }

      if (event.key === 'ArrowRight') {
        rightHandler()
        return true
      }

      if (event.key === 'Tab') {
        event.preventDefault()
        downHandler()
        return true
      }

      if (event.key === 'Enter' && selectedIndex >= 0 && gifs.length > 0) {
        enterHandler()
        return true
      }

      return false
    }
  }))

  useEffect(() => {
    // Scroll selected item into view
    const selectedElement = document.querySelector(`[data-gif-index="${selectedIndex}"]`)
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [selectedIndex])

  if (isLoading) {
    return (
      <div className="border rounded-lg bg-background z-50 pointer-events-auto p-4 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">{t('Searching GIFs...')}</span>
      </div>
    )
  }

  if (!gifs.length) {
    return (
      <div className="border rounded-lg bg-background z-50 pointer-events-auto p-4">
        <p className="text-sm text-muted-foreground">
          {props.query ? t('No GIFs found for "{{query}}"', { query: props.query }) : t('Start typing to search GIFs...')}
        </p>
      </div>
    )
  }

  return (
    <ScrollArea
      className="border rounded-lg bg-background z-50 pointer-events-auto flex flex-col max-h-96 overflow-y-auto p-2"
      onWheel={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
    >
      <div className="text-xs text-muted-foreground mb-2 px-1">
        {t('Use ↑↓←→ or Tab to navigate, Enter to select')}
      </div>
      <div className="grid grid-cols-4 gap-2">
        {gifs.map((gif, index) => (
          <button
            key={gif.eventId || `${gif.url}-${index}`}
            data-gif-index={index}
            className={cn(
              'relative aspect-square overflow-hidden rounded-md border transition-all cursor-pointer',
              selectedIndex === index
                ? 'border-primary ring-2 ring-primary ring-offset-2 ring-offset-background'
                : 'border-border hover:border-primary'
            )}
            onClick={() => selectItem(index)}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <img
              src={gif.previewUrl || gif.url}
              alt={gif.alt || 'GIF'}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </button>
        ))}
      </div>
    </ScrollArea>
  )
})

GifList.displayName = 'GifList'
export default GifList
