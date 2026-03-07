import MailboxSetting from '@/components/MailboxSetting'
import RelayTutorialDialog from '@/components/RelayTutorialDialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { useNostr } from '@/providers/NostrProvider'
import { Loader2 } from 'lucide-react'
import { forwardRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

const RelaySettingsPage = forwardRef(({ index }: { index?: number }, ref) => {
  const { t } = useTranslation()
  const { pubkey, relayList, checkLogin } = useNostr()

  const readRelayCount = useMemo(
    () => relayList?.originalRelays.filter((relay) => relay.scope !== 'write').length ?? 0,
    [relayList]
  )
  const writeRelayCount = useMemo(
    () => relayList?.originalRelays.filter((relay) => relay.scope !== 'read').length ?? 0,
    [relayList]
  )

  return (
    <SecondaryPageLayout ref={ref} index={index} title={t('Relay settings')}>
      <div className="space-y-4 px-4 py-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('Relay settings')}</CardTitle>
            <CardDescription>
              {t(
                'Keep this simple. Read relays are where x21 looks for notes. Publish relays are where x21 sends your notes.'
              )}
            </CardDescription>
            <div className="pt-1">
              <RelayTutorialDialog>
                <button
                  type="button"
                  className="text-sm font-medium text-primary transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  {t("What's a relay?")}
                </button>
              </RelayTutorialDialog>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border bg-card/60 px-4 py-3">
                <div className="font-medium text-foreground">{t('Read Relays')}</div>
                <p className="mt-1">
                  {t('Where we look for notes. We recommend keeping this to 1 or 2 relays.')}
                </p>
              </div>
              <div className="rounded-2xl border bg-card/60 px-4 py-3">
                <div className="font-medium text-foreground">{t('Publish Relays')}</div>
                <p className="mt-1">
                  {t('Where we send your notes. We recommend 2 relays. 3 is still fine if you want more redundancy.')}
                </p>
              </div>
            </div>
            {!!relayList && (
              <div className="flex flex-wrap gap-3 text-xs">
                <span className="rounded-full bg-muted px-3 py-1">
                  {t('Read relays')}: <span className="font-medium text-foreground">{readRelayCount}</span>
                </span>
                <span className="rounded-full bg-muted px-3 py-1">
                  {t('Publish relays')}:{' '}
                  <span className="font-medium text-foreground">{writeRelayCount}</span>
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {!pubkey ? (
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center gap-3">
                <div className="text-sm text-muted-foreground">
                  {t('Sign in to manage your relays')}
                </div>
                <Button size="lg" onClick={() => checkLogin()}>
                  {t('Login')}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : !relayList ? (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                {t('Loading relay settings...')}
              </div>
            </CardContent>
          </Card>
        ) : (
          <MailboxSetting />
        )}
      </div>
    </SecondaryPageLayout>
  )
})
RelaySettingsPage.displayName = 'RelaySettingsPage'
export default RelaySettingsPage
