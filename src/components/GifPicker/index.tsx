import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerTrigger } from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import gifService, { GifData } from '@/services/gif.service'
import { ImagePlay, Loader2, X, Upload, Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Tabs from '@/components/Tabs'
import { useNostr } from '@/providers/NostrProvider'
import GifUploadDialog from './GifUploadDialog'

export interface GifPickerProps {
  onGifSelect: (url: string) => void
  children?: React.ReactNode
}

type TabValue = 'all' | 'my'

function GifPickerContent({
  onGifClick,
  isSmallScreen,
  onClose
}: {
  onGifClick: (gif: GifData) => void
  isSmallScreen: boolean
  onClose?: () => void
}) {
  const { t } = useTranslation()
  const { pubkey } = useNostr()
  const [activeTab, setActiveTab] = useState<TabValue>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [gifs, setGifs] = useState<GifData[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false)
  const searchTimeoutRef = useRef<NodeJS.Timeout>()
  const offsetRef = useRef(0)

  // Determine how many GIFs to show based on screen size
  const gridCols = isSmallScreen ? 2 : 4
  const gifsPerPage = isSmallScreen ? 12 : 32

  // Load GIFs when tab or search changes
  useEffect(() => {
    if (activeTab === 'all') {
      loadRecentGifs()
    } else {
      loadMyGifs()
    }

    // Subscribe to cache updates
    const unsubscribe = gifService.onCacheUpdate(() => {
      // Reload when cache is updated
      if (activeTab === 'all' && !searchQuery) {
        loadRecentGifs()
      } else if (activeTab === 'my') {
        loadMyGifs()
      }
    })

    return () => {
      unsubscribe()
    }
  }, [searchQuery, activeTab])

  const loadRecentGifs = async () => {
    setIsLoading(true)
    offsetRef.current = 0
    try {
      const { gifs: recentGifs, hasMore: more } = await gifService.fetchRecentGifs(gifsPerPage, 0)
      setGifs(recentGifs)
      setHasMore(more)
      offsetRef.current = recentGifs.length
    } catch (error) {
      console.error('Error loading recent GIFs:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadMyGifs = async () => {
    if (!pubkey) {
      setGifs([])
      setHasMore(false)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    offsetRef.current = 0
    try {
      const { gifs: myGifs, hasMore: more } = await gifService.fetchMyGifs(pubkey, gifsPerPage, 0)
      setGifs(myGifs)
      setHasMore(more)
      offsetRef.current = myGifs.length
    } catch (error) {
      console.error('Error loading my GIFs:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadMoreGifs = async () => {
    if (isLoadingMore) return

    setIsLoadingMore(true)
    try {
      let result
      if (searchQuery) {
        // Search works across both tabs
        result = await gifService.searchGifs(searchQuery, gifsPerPage, offsetRef.current, activeTab === 'my' ? pubkey : undefined)
      } else if (activeTab === 'my' && pubkey) {
        result = await gifService.fetchMyGifs(pubkey, gifsPerPage, offsetRef.current)
      } else {
        result = await gifService.fetchRecentGifs(gifsPerPage, offsetRef.current)
      }

      setGifs((prev) => [...prev, ...result.gifs])
      setHasMore(result.hasMore)
      offsetRef.current += result.gifs.length
    } catch (error) {
      console.error('Error loading more GIFs:', error)
    } finally {
      setIsLoadingMore(false)
    }
  }

  const handleSearch = async (query: string) => {
    setSearchQuery(query)

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    // Debounce search
    searchTimeoutRef.current = setTimeout(async () => {
      setIsLoading(true)
      offsetRef.current = 0
      try {
        // Search works across both tabs, filtering by pubkey for "my" tab
        const { gifs: results, hasMore: more } = await gifService.searchGifs(
          query,
          gifsPerPage,
          0,
          activeTab === 'my' ? pubkey : undefined
        )
        setGifs(results)
        setHasMore(more)
        offsetRef.current = results.length
      } catch (error) {
        console.error('Error searching GIFs:', error)
      } finally {
        setIsLoading(false)
      }
    }, 300)
  }

  const handleUploadSuccess = () => {
    setIsUploadDialogOpen(false)
    // Reload my GIFs
    if (activeTab === 'my') {
      loadMyGifs()
    }
  }

  const tabs = [
    { value: 'all', label: 'All Gifs' },
    { value: 'my', label: 'My Gifs' }
  ]

  return (
    <div className="space-y-3 p-3">
      <div className="flex items-center justify-between gap-2">
        <Input
          placeholder={t('Search GIFs...')}
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          className="flex-1"
          autoFocus={!isSmallScreen}
        />
        {pubkey && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsUploadDialogOpen(true)}
            className="shrink-0"
            title={t('Upload GIF')}
          >
            <Plus className="h-4 w-4" />
          </Button>
        )}
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <Tabs
        tabs={tabs}
        value={activeTab}
        onTabChange={(tab) => setActiveTab(tab as TabValue)}
        threshold={0}
      />

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {gifs.length > 0 && (
            <>
              {t('Showing {{count}} GIFs', { count: gifs.length })}
              {hasMore && ' • ' + t('More available')}
            </>
          )}
        </span>
        <span className="text-xs">
          {activeTab === 'all'
            ? t('Cache: {{count}}', { count: gifService.getCacheSize() })
            : pubkey && t('My GIFs')
          }
        </span>
      </div>
      <div
        className={`overflow-y-auto pr-3 ${isSmallScreen ? 'h-80' : 'h-96'}`}
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: 'hsl(var(--border)) transparent',
          overscrollBehavior: 'contain'
        }}
        onWheel={(e) => {
          e.stopPropagation()
        }}
      >
        {isLoading ? (
          <div className="flex items-center justify-center" style={{ minHeight: isSmallScreen ? '20rem' : '24rem' }}>
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : gifs.length > 0 ? (
          <div className="space-y-3">
            <div
              className="grid gap-2"
              style={{
                gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`
              }}
            >
              {gifs.map((gif, index) => (
                <button
                  key={gif.eventId || `${gif.url}-${index}`}
                  onClick={() => onGifClick(gif)}
                  className="relative aspect-square overflow-hidden rounded-md border border-border hover:border-primary transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  title={gif.alt}
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
            {hasMore && (
              <div className="flex justify-center pt-2 pb-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadMoreGifs}
                  disabled={isLoadingMore}
                  className="w-full"
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {t('Loading...')}
                    </>
                  ) : (
                    t('Load More')
                  )}
                </Button>
              </div>
            )}
          </div>
        ) : activeTab === 'my' && !pubkey ? (
          <div className="flex flex-col items-center justify-center gap-3 text-sm text-muted-foreground" style={{ minHeight: isSmallScreen ? '20rem' : '24rem' }}>
            <p>{t('Please log in to view and upload your GIFs')}</p>
          </div>
        ) : activeTab === 'my' && pubkey ? (
          <div className="flex flex-col items-center justify-center gap-3" style={{ minHeight: isSmallScreen ? '20rem' : '24rem' }}>
            <p className="text-sm text-muted-foreground">{searchQuery ? t('No GIFs found') : t('You haven\'t uploaded any GIFs yet')}</p>
            <Button onClick={() => setIsUploadDialogOpen(true)} size="sm">
              <Upload className="h-4 w-4 mr-2" />
              {t('Upload GIF')}
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-center text-sm text-muted-foreground" style={{ minHeight: isSmallScreen ? '20rem' : '24rem' }}>
            {searchQuery ? t('No GIFs found') : t('No recent GIFs')}
          </div>
        )}
      </div>

      {activeTab === 'my' && pubkey && gifs.length > 0 && (
        <div className="flex justify-center pt-2">
          <Button onClick={() => setIsUploadDialogOpen(true)} size="sm" variant="outline" className="w-full">
            <Upload className="h-4 w-4 mr-2" />
            {t('Upload GIF')}
          </Button>
        </div>
      )}

      {pubkey && (
        <GifUploadDialog
          open={isUploadDialogOpen}
          onOpenChange={setIsUploadDialogOpen}
          onSuccess={handleUploadSuccess}
        />
      )}
    </div>
  )
}

export default function GifPicker({ onGifSelect, children }: GifPickerProps) {
  const { t } = useTranslation()
  const { isSmallScreen } = useScreenSize()
  const [open, setOpen] = useState(false)

  const handleGifClick = (gif: GifData) => {
    onGifSelect(gif.url)
    setOpen(false)
  }

  const handleClose = () => {
    setOpen(false)
  }

  if (isSmallScreen) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>
          {children || (
            <Button variant="ghost" size="icon" title={t('Add GIF')}>
              <ImagePlay />
            </Button>
          )}
        </DrawerTrigger>
        <DrawerContent>
          <GifPickerContent
            onGifClick={handleGifClick}
            isSmallScreen={isSmallScreen}
            onClose={handleClose}
          />
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {children || (
          <Button variant="ghost" size="icon" title={t('Add GIF')}>
            <ImagePlay />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-[560px] p-0" align="start" side="top">
        <GifPickerContent
          onGifClick={handleGifClick}
          isSmallScreen={isSmallScreen}
          onClose={handleClose}
        />
      </PopoverContent>
    </Popover>
  )
}
