import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { isDevEnv } from '@/lib/utils'
import { useNostr } from '@/providers/NostrProvider'
import { useTheme } from '@/providers/ThemeProvider'
import { NstartModal } from 'nstart-modal'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import AccountList from '../AccountList'
import GenerateNewAccount from './GenerateNewAccount'
import NostrConnectLogin from './NostrConnectionLogin'
import NpubLogin from './NpubLogin'
import PrivateKeyLogin from './PrivateKeyLogin'
import SignupOnboarding from './SignupOnboarding'

type TAccountManagerPage = 'nsec' | 'bunker' | 'generate' | 'npub' | 'signup' | null

export default function AccountManager({ close }: { close?: () => void }) {
  const [page, setPage] = useState<TAccountManagerPage>(null)

  return (
    <>
      {page === 'nsec' ? (
        <PrivateKeyLogin back={() => setPage(null)} onLoginSuccess={() => close?.()} />
      ) : page === 'bunker' ? (
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
  const { t, i18n } = useTranslation()
  const { themeSetting } = useTheme()
  const { nip07Login, bunkerLogin, nsecLogin, ncryptsecLogin, accounts } = useNostr()
  const [showMoreOptions, setShowMoreOptions] = useState(false)

  return (
    <div onClick={(e) => e.stopPropagation()} className="flex flex-col gap-8">
      <div>
        <div className="text-center text-muted-foreground text-sm font-semibold">
          {t('Add an Account')}
        </div>
        <div className="space-y-2 mt-4">
          {!!window.nostr && (
            <Button onClick={() => nip07Login().then(() => close?.())} className="w-full">
              {t('Login with Browser Extension')}
            </Button>
          )}
          <Button variant="secondary" onClick={() => setPage('bunker')} className="w-full">
            {t('Login with Bunker')}
          </Button>
          {showMoreOptions && (
            <>
              <Button variant="secondary" onClick={() => setPage('nsec')} className="w-full">
                {t('Login with Private Key')}
              </Button>
              {isDevEnv() && (
                <Button variant="secondary" onClick={() => setPage('npub')} className="w-full">
                  Login with Public Key
                </Button>
              )}
            </>
          )}
          <Button
            variant="link"
            onClick={() => setShowMoreOptions(!showMoreOptions)}
            className="w-full text-muted-foreground py-0 h-fit"
          >
            {showMoreOptions ? t('Less options') : t('More options')}
          </Button>
        </div>
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
    </div>
  )
}
