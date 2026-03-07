import FavoriteRelaysSetting from '@/components/FavoriteRelaysSetting'
import MailboxSetting from '@/components/MailboxSetting'
import RelayTutorialDialog from '@/components/RelayTutorialDialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { useFavoriteRelays } from '@/providers/FavoriteRelaysProvider'
import { useNostr } from '@/providers/NostrProvider'
import { Loader2, Sparkles } from 'lucide-react'
import { forwardRef, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

const RelaySettingsPage = forwardRef(({ index }: { index?: number }, ref) => {
  const { t } = useTranslation()
  const { pubkey, relayList, checkLogin } = useNostr()
  const { favoriteRelays } = useFavoriteRelays()
  const [mode, setMode] = useState<'simple' | 'advanced'>('simple')
  const [advancedTab, setAdvancedTab] = useState('routing')

  useEffect(() => {
    switch (window.location.hash) {
      case '#advanced':
        setMode('advanced')
        break
      case '#routing':
      case '#mailbox':
        setMode('advanced')
        setAdvancedTab('routing')
        break
      case '#sources':
        setMode('advanced')
        setAdvancedTab('sources')
        break
      case '#favorite-relays':
        setMode('advanced')
        setAdvancedTab('sources')
        break
      default:
        setMode('simple')
    }
  }, [])

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
      <div className="px-4 py-3 space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('Relay Control Center')}</CardTitle>
            <CardDescription>
              {t(
                'Relays decide where you receive posts from and where your posts are published. Use Simple mode for standard behavior, or Advanced for full control.'
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
        </Card>

        <Tabs value={mode} onValueChange={(value) => setMode(value as 'simple' | 'advanced')}>
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="simple">{t('Simple')}</TabsTrigger>
            <TabsTrigger value="advanced">{t('Advanced')}</TabsTrigger>
          </TabsList>
          <TabsContent value="simple" className="space-y-4 pt-4">
            {!pubkey ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center gap-3">
                    <div className="text-sm text-muted-foreground">
                      {t('Sign in to view and manage your relay setup')}
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
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">{t('Standard behavior active')}</CardTitle>
                  <CardDescription>
                    {t(
                      'You are using the default relay flow. Switch to Advanced only if you want to fine-tune routing.'
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t('Receive posts from')}</span>
                    <span className="font-medium">{readRelayCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t('Publish posts to')}</span>
                    <span className="font-medium">{writeRelayCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t('Saved relay sources')}</span>
                    <span className="font-medium">{favoriteRelays.length}</span>
                  </div>
                  <Button variant="outline" className="w-full mt-2" onClick={() => setMode('advanced')}>
                    {t('Open advanced controls')}
                  </Button>
                </CardContent>
              </Card>
            )}

            {pubkey && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Sparkles className="size-4" />
                    {t('Smart recommendations')}
                  </CardTitle>
                  <CardDescription>
                    {t(
                      'Suggestions from your language, region, and the people you follow. These save automatically when added.'
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FavoriteRelaysSetting
                    compact
                    hideRelaySets
                    hideRelayList
                    hideManualAdd
                    hideAutoSaveNotice
                    includeFollowsRecommendations
                  />
                </CardContent>
              </Card>
            )}
          </TabsContent>
          <TabsContent value="advanced" className="space-y-4 pt-4">
            <Tabs value={advancedTab} onValueChange={setAdvancedTab} className="space-y-4">
              <TabsList className="w-full grid grid-cols-2">
                <TabsTrigger value="routing">{t('Receive & Publish')}</TabsTrigger>
                <TabsTrigger value="sources">{t('Relay Sources')}</TabsTrigger>
              </TabsList>
              <TabsContent value="routing">
                <MailboxSetting />
              </TabsContent>
              <TabsContent value="sources">
                <FavoriteRelaysSetting />
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>
      </div>
    </SecondaryPageLayout>
  )
})
RelaySettingsPage.displayName = 'RelaySettingsPage'
export default RelaySettingsPage
