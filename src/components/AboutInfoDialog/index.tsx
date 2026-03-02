import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerTrigger } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { CODY_PUBKEY } from '@/constants'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Username from '../Username'
import Logo from '@/assets/Logo'

const KARNAGE_PUBKEY = '1bc70a0148b3f316da33fe3c89f23e3e71ac4ff998027ec712b905cd24f6a411'

export default function AboutInfoDialog({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation()
  const { isSmallScreen } = useScreenSize()
  const [open, setOpen] = useState(false)

  const content = (
    <>
      <div className="flex items-center gap-3 mb-4">
        <Logo className="max-w-[64px]" />
      </div>
      <div className="space-y-4">
        <div className="text-muted-foreground leading-relaxed">
          {t('x21 is a new type of social app that is powered by an open protocol called Nostr. This app is a fork of the Jumble client which was originally created by')}{' '}
          <Username userId={CODY_PUBKEY} className="inline-block text-primary" showAt />. {t('The current build is maintained by')}{' '}
          <Username userId={KARNAGE_PUBKEY} className="inline-block text-primary" showAt />.
        </div>
        <div className="text-muted-foreground leading-relaxed">
          {t('Because x21 is built on an open protocol, you can clone it for yourself and modify it any way you see fit. This is very easy to do in Shakespeare - an application for creating your own apps on the Nostr protocol. Shakespeare makes it easy to clone x21 with a single click and modify its features.')}
        </div>
        <div>
          <Button
            asChild
            className="w-full sm:w-auto"
          >
            <a
              href="https://shakespeare.diy/clone?url=https%3A%2F%2Fgithub.com%2Fkarnagebitcoin%2Fx21.git"
              target="_blank"
              rel="noreferrer"
            >
              {t('Clone x21 in Shakespeare')}
            </a>
          </Button>
        </div>
        <div>
          {t('Source code')}:{' '}
          <a
            href="https://github.com/karnagebitcoin/x21"
            target="_blank"
            rel="noreferrer"
            className="text-primary hover:underline"
          >
            GitHub
          </a>
        </div>
      </div>
    </>
  )

  if (isSmallScreen) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>{children}</DrawerTrigger>
        <DrawerContent>
          <div className="p-4 space-y-4">{content}</div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>{content}</DialogContent>
    </Dialog>
  )
}
