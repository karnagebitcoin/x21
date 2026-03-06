import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { isDevEnv } from '@/lib/utils'
import { useNostr } from '@/providers/NostrProvider'
import { KeyRound, Puzzle, QrCode } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import AccountList from '../AccountList'
import GenerateNewAccount from './GenerateNewAccount'
import NostrConnectLogin from './NostrConnectionLogin'
import NpubLogin from './NpubLogin'
import PrivateKeyLogin from './PrivateKeyLogin'
import SignupOnboarding from './SignupOnboarding'

type TAccountManagerPage = 'key' | 'signer' | 'generate' | 'npub' | 'signup' | null

export default function AccountManager({ close }: { close?: () => void }) {
  const [page, setPage] = useState<TAccountManagerPage>(null)

  return (
    <>
      {page === 'key' ? (
        <PrivateKeyLogin back={() => setPage(null)} onLoginSuccess={() => close?.()} />
      ) : page === 'signer' ? (
        <NostrConnectLogin back={() => setPage(null)} onLoginSuccess={() => close?.()} />
      ) : page === 'generate' ? (
        <GenerateNewAccount back={() => setPage(null)} onLoginSuccess={() => close?.()} />
      ) : page === 'npub' ? (
        <NpubLogin back={() => setPage(null)} onLoginSuccess={() => close?.()} />
      ) : page === 'signup' ? (
        <SignupOnboarding back={() => setPage(null)} onComplete={() => close?.()} />
      ) : (
        <AccountManagerNav setPage={setPage} close={close} />
      )}
    </>
  )
}

function AccountManagerNav({
  setPage,
  close
}: {
  setPage: (page: TAccountManagerPage) => void
  close?: () => void
}) {
  const { t } = useTranslation()
  const { nip07Login, accounts } = useNostr()
  const [showNoExtensionDialog, setShowNoExtensionDialog] = useState(false)

  const handleExtensionLogin = () => {
    if (!window.nostr) {
      setShowNoExtensionDialog(true)
      return
    }

    nip07Login()
      .then(() => close?.())
      .catch(() => {})
  }

  return (
    <div onClick={(e) => e.stopPropagation()} className="flex flex-col gap-8">
      <div>
        <div className="text-center text-muted-foreground text-sm font-semibold">
          {t('Add an Account')}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <Button
            type="button"
            variant="secondary"
            className="h-24 flex-col gap-2 text-sm"
            onClick={handleExtensionLogin}
          >
            <Puzzle className="h-5 w-5" />
            {t('Extension')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="h-24 flex-col gap-2 text-sm"
            onClick={() => setPage('signer')}
          >
            <QrCode className="h-5 w-5" />
            {t('Signer')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="h-24 flex-col gap-2 text-sm"
            onClick={() => setPage('key')}
          >
            <KeyRound className="h-5 w-5" />
            {t('Key')}
          </Button>
        </div>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Extension uses a browser signer. Signer connects to a signer app. Key lets you paste an
          nsec or ncryptsec.
        </p>
        {isDevEnv() && (
          <Button
            variant="link"
            onClick={() => setPage('npub')}
            className="mt-1 h-fit w-full py-0 text-muted-foreground"
          >
            Login with Public Key
          </Button>
        )}
      </div>
      <Separator />
      <div>
        <div className="text-center text-muted-foreground text-sm font-semibold">
          {t("Don't have an account yet?")}
        </div>
        <Button
          onClick={() => setPage('signup')}
          className="w-full mt-2"
        >
          {t('Sign up')}
        </Button>
        <Button
          variant="link"
          onClick={() => setPage('generate')}
          className="w-full text-muted-foreground py-0 h-fit mt-1"
        >
          {t('or simply generate a private key')}
        </Button>
      </div>
      {accounts.length > 0 && (
        <>
          <Separator />
          <div>
            <div className="text-center text-muted-foreground text-sm font-semibold">
              {t('Logged in Accounts')}
            </div>
            <AccountList className="mt-4" afterSwitch={() => close?.()} />
          </div>
        </>
      )}
      <Dialog open={showNoExtensionDialog} onOpenChange={setShowNoExtensionDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>No extension found</DialogTitle>
            <DialogDescription>
              Install a browser signer extension, then come back and click Extension again.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <a
              href="https://chromewebstore.google.com/detail/nos2x/kpgefcfmnafjgpblomihpgmejjdanjjp"
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-border/70 bg-muted/20 px-3 py-3 text-sm transition-colors hover:bg-muted/40"
            >
              <div className="font-medium">nos2x</div>
              <div className="text-xs text-muted-foreground">Chrome Web Store, by fiatjaf</div>
            </a>
            <a
              href="https://keys.band"
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-border/70 bg-muted/20 px-3 py-3 text-sm transition-colors hover:bg-muted/40"
            >
              <div className="font-medium">keys.band</div>
              <div className="text-xs text-muted-foreground">Open the website and install a signer extension</div>
            </a>
          </div>
          <Button type="button" variant="secondary" onClick={() => setShowNoExtensionDialog(false)}>
            Close
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}
