import { Button } from '@/components/ui/button'
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
  DrawerHeader,
  DrawerTitle
} from '@/components/ui/drawer'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { Copy, Check } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import UserAvatar from '../UserAvatar'
import Username from '../Username'

interface ShareListDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  listId: string
  ownerPubkey: string
  title: string
  description?: string
  image?: string
  memberCount: number
}

export default function ShareListDialog({
  open,
  onOpenChange,
  listId,
  ownerPubkey,
  title,
  description,
  image,
  memberCount
}: ShareListDialogProps) {
  const { t } = useTranslation()
  const { isSmallScreen } = useScreenSize()
  const [copied, setCopied] = useState(false)

  const shareUrl = `${window.location.origin}/lists/${ownerPubkey}:${listId}?preview=1`

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      toast.success(t('Link copied to clipboard'))
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy link:', error)
      toast.error(t('Failed to copy link'))
    }
  }

  const content = (
    <div className="flex flex-col gap-4">
      {/* List Preview */}
      <div className="border rounded-lg overflow-hidden">
        {image && (
          <div className="w-full h-48 overflow-hidden">
            <img src={image} alt={title} className="w-full h-full object-cover" />
          </div>
        )}
        <div className="p-4 space-y-3">
          <h3 className="font-semibold text-lg">{title}</h3>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{t('By')}</span>
            <UserAvatar userId={ownerPubkey} size="small" />
            <Username userId={ownerPubkey} className="text-sm font-medium" />
          </div>

          {description && (
            <p className="text-sm text-muted-foreground line-clamp-3">{description}</p>
          )}

          <div className="text-sm text-muted-foreground">
            {memberCount} {memberCount === 1 ? t('member') : t('members')}
          </div>
        </div>
      </div>

      {/* Share URL */}
      <div className="space-y-2">
        <label className="text-sm font-medium">{t('Share this link')}</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={shareUrl}
            readOnly
            className="flex-1 px-3 py-2 text-sm border rounded-md bg-muted"
            onClick={(e) => e.currentTarget.select()}
          />
          <Button
            onClick={handleCopyLink}
            variant="outline"
            className="h-[38px] w-[38px] p-0 flex-shrink-0"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  )

  if (isSmallScreen) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="px-4 pb-4">
          <DrawerHeader>
            <DrawerTitle>{t('Share List')}</DrawerTitle>
          </DrawerHeader>
          {content}
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('Share List')}</DialogTitle>
          <DialogDescription>
            {t('Share this list with others. They can view and follow all members.')}
          </DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  )
}
