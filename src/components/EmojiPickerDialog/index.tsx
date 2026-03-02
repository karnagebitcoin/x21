import { Drawer, DrawerContent, DrawerTrigger } from '@/components/ui/drawer'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { TEmoji } from '@/types'
import { lazy, Suspense, useState } from 'react'

// Lazy load the heavy EmojiPicker component
const EmojiPicker = lazy(() => import('../EmojiPicker'))

function EmojiPickerFallback() {
  return (
    <div className="w-[350px] h-[400px] p-4 flex flex-col gap-2">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-8 w-full" />
      <div className="grid grid-cols-8 gap-2 flex-1">
        {Array.from({ length: 40 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-8 rounded" />
        ))}
      </div>
    </div>
  )
}

export default function EmojiPickerDialog({
  children,
  onEmojiClick
}: {
  children: React.ReactNode
  onEmojiClick?: (emoji: string | TEmoji | undefined) => void
}) {
  const { isSmallScreen } = useScreenSize()
  const [open, setOpen] = useState(false)

  if (isSmallScreen) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>{children}</DrawerTrigger>
        <DrawerContent>
          <Suspense fallback={<EmojiPickerFallback />}>
            <EmojiPicker
              onEmojiClick={(emoji, e) => {
                e.stopPropagation()
                setOpen(false)
                onEmojiClick?.(emoji)
              }}
            />
          </Suspense>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent side="top" className="p-0 w-fit">
        <Suspense fallback={<EmojiPickerFallback />}>
          <EmojiPicker
            onEmojiClick={(emoji, e) => {
              e.stopPropagation()
              setOpen(false)
              onEmojiClick?.(emoji)
            }}
          />
        </Suspense>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
