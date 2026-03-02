import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerTrigger } from '@/components/ui/drawer'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Sparkles, Image as ImageIcon, Search, Smile, AtSign } from 'lucide-react'

export default function ComposerHelpDialog({ children }: { children: React.ReactNode }) {
  const { isSmallScreen } = useScreenSize()
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  const helpItems = [
    {
      icon: <Sparkles className="h-4 w-4" />,
      command: '/gif',
      description: t('Search and insert GIFs')
    },
    {
      icon: <ImageIcon className="h-4 w-4" />,
      command: '/image',
      description: t('Generate AI images (requires AI key)')
    },
    {
      icon: <Search className="h-4 w-4" />,
      command: '/web',
      description: t('Search the web (requires AI key)')
    },
    {
      icon: <Smile className="h-4 w-4" />,
      command: ':',
      description: t('Insert emojis (including custom emojis)')
    },
    {
      icon: <AtSign className="h-4 w-4" />,
      command: '@',
      description: t('Mention users')
    }
  ]

  const content = (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-lg mb-2">{t('Composer Features')}</h3>
        <p className="text-sm text-muted-foreground">
          {t('Use these commands while composing your note:')}
        </p>
      </div>

      <div className="space-y-3">
        {helpItems.map((item, index) => (
          <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-muted/40">
            <div className="flex-shrink-0 mt-0.5 text-primary">{item.icon}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 mb-1">
                <code className="text-sm font-mono font-semibold bg-background/60 px-2 py-0.5 rounded">
                  {item.command}
                </code>
              </div>
              <p className="text-sm text-muted-foreground">{item.description}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="text-xs text-muted-foreground pt-2 border-t">
        {t('More features will be added over time. Start typing these commands to try them out!')}
      </div>
    </div>
  )

  if (isSmallScreen) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>{children}</DrawerTrigger>
        <DrawerContent>
          <div className="p-4 pb-8 space-y-4">{content}</div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-md">{content}</DialogContent>
    </Dialog>
  )
}
