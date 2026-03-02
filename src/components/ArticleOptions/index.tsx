import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription
} from '@/components/ui/drawer'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { Code, Copy, Link, MoreVertical } from 'lucide-react'
import { Event, nip19 } from 'nostr-tools'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import RawEventDialog from './RawEventDialog'

interface ArticleOptionsProps {
  event: Event
}

export default function ArticleOptions({ event }: ArticleOptionsProps) {
  const { t } = useTranslation()
  const { isSmallScreen } = useScreenSize()
  const [isRawEventDialogOpen, setIsRawEventDialogOpen] = useState(false)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  const getArticleUrl = () => {
    const noteId = nip19.naddrEncode({
      kind: event.kind,
      pubkey: event.pubkey,
      identifier: event.tags.find((tag) => tag[0] === 'd')?.[1] || ''
    })
    return `${window.location.origin}/#/article/${noteId}`
  }

  const handleCopyUrl = async () => {
    try {
      const url = getArticleUrl()
      await navigator.clipboard.writeText(url)
      toast.success(t('URL copied to clipboard'))
    } catch (error) {
      console.error('Failed to copy URL:', error)
      toast.error(t('Failed to copy to clipboard'))
    }
    setIsDrawerOpen(false)
  }

  const handleCopyEventId = async () => {
    try {
      const noteId = nip19.naddrEncode({
        kind: event.kind,
        pubkey: event.pubkey,
        identifier: event.tags.find((tag) => tag[0] === 'd')?.[1] || ''
      })
      await navigator.clipboard.writeText(noteId)
      toast.success(t('Event ID copied to clipboard'))
    } catch (error) {
      console.error('Failed to copy event ID:', error)
      toast.error(t('Failed to copy to clipboard'))
    }
    setIsDrawerOpen(false)
  }

  const handleViewRawSource = () => {
    setIsDrawerOpen(false)
    setIsRawEventDialogOpen(true)
  }

  if (isSmallScreen) {
    return (
      <>
        <Button
          variant="ghost"
          size="titlebar-icon"
          onClick={() => setIsDrawerOpen(true)}
        >
          <MoreVertical />
        </Button>

        <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>{t('Article options')}</DrawerTitle>
              <DrawerDescription className="hidden" />
            </DrawerHeader>
            <div className="p-4 space-y-1">
              <button
                onClick={handleCopyUrl}
                className="flex items-center gap-3 w-full p-3 text-left hover:bg-accent rounded-lg"
              >
                <Link className="w-5 h-5" />
                <span>{t('Copy URL')}</span>
              </button>
              <button
                onClick={handleCopyEventId}
                className="flex items-center gap-3 w-full p-3 text-left hover:bg-accent rounded-lg"
              >
                <Copy className="w-5 h-5" />
                <span>{t('Copy Event ID')}</span>
              </button>
              <button
                onClick={handleViewRawSource}
                className="flex items-center gap-3 w-full p-3 text-left hover:bg-accent rounded-lg"
              >
                <Code className="w-5 h-5" />
                <span>{t('View Raw Source')}</span>
              </button>
            </div>
          </DrawerContent>
        </Drawer>

        <RawEventDialog
          event={event}
          isOpen={isRawEventDialogOpen}
          onClose={() => setIsRawEventDialogOpen(false)}
        />
      </>
    )
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="titlebar-icon">
            <MoreVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleCopyUrl}>
            <Link className="w-4 h-4 mr-2" />
            {t('Copy URL')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleCopyEventId}>
            <Copy className="w-4 h-4 mr-2" />
            {t('Copy Event ID')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleViewRawSource}>
            <Code className="w-4 h-4 mr-2" />
            {t('View Raw Source')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <RawEventDialog
        event={event}
        isOpen={isRawEventDialogOpen}
        onClose={() => setIsRawEventDialogOpen(false)}
      />
    </>
  )
}
