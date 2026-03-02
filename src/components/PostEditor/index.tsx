import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle
} from '@/components/ui/drawer'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import postEditor from '@/services/post-editor.service'
import { Event } from 'nostr-tools'
import { Dispatch, useMemo, useState } from 'react'
import PostContent from './PostContent'
import Title from './Title'

export default function PostEditor({
  defaultContent = '',
  parentEvent,
  open,
  setOpen,
  openFrom
}: {
  defaultContent?: string
  parentEvent?: Event
  open: boolean
  setOpen: Dispatch<boolean>
  openFrom?: string[]
}) {
  const { isSmallScreen } = useScreenSize()
  const [isProtectedEvent, setIsProtectedEvent] = useState(false)
  const [additionalRelayUrls, setAdditionalRelayUrls] = useState<string[]>([])

  const content = useMemo(() => {
    return (
      <PostContent
        defaultContent={defaultContent}
        parentEvent={parentEvent}
        close={() => setOpen(false)}
        openFrom={openFrom}
        isProtectedEvent={isProtectedEvent}
        additionalRelayUrls={additionalRelayUrls}
      />
    )
  }, [defaultContent, parentEvent, openFrom, isProtectedEvent, additionalRelayUrls])

  if (isSmallScreen) {
    return (
      <Drawer open={open} onOpenChange={setOpen} shouldScaleBackground={false}>
        <DrawerContent
          className="bg-card flex flex-col"
          fullHeight
          onEscapeKeyDown={(e) => {
            if (postEditor.isSuggestionPopupOpen) {
              e.preventDefault()
              postEditor.closeSuggestionPopup()
            }
          }}
        >
          <div className="flex-shrink-0 px-4 pt-4 pb-2 border-b">
            <DrawerTitle id="post-editor-title" className="text-start">
              <Title
                parentEvent={parentEvent}
                openFrom={openFrom}
                setIsProtectedEvent={setIsProtectedEvent}
                setAdditionalRelayUrls={setAdditionalRelayUrls}
              />
            </DrawerTitle>
            <DrawerDescription className="hidden" />
          </div>
          <ScrollArea className="flex-1 w-full">
            <div className="space-y-4 px-4 py-4 pb-8">
              {content}
            </div>
          </ScrollArea>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="p-0 max-w-2xl bg-card"
        withoutClose
        onEscapeKeyDown={(e) => {
          if (postEditor.isSuggestionPopupOpen) {
            e.preventDefault()
            postEditor.closeSuggestionPopup()
          }
        }}
        aria-labelledby="post-editor-title"
      >
        <ScrollArea className="px-4 h-full max-h-screen">
          <div className="space-y-4 px-2 py-6">
            <DialogHeader>
              <DialogTitle id="post-editor-title">
                <Title
                  parentEvent={parentEvent}
                  openFrom={openFrom}
                  setIsProtectedEvent={setIsProtectedEvent}
                  setAdditionalRelayUrls={setAdditionalRelayUrls}
                />
              </DialogTitle>
              <DialogDescription className="hidden" />
            </DialogHeader>
            {content}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
