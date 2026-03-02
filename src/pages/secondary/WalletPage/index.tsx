import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { useZap } from '@/providers/ZapProvider'
import { disconnect, launchModal } from '@getalby/bitcoin-connect-react'
import {
  Zap,
  Volume2,
  Settings2,
  Wallet,
  Gauge,
  MessageSquare,
  MousePointerClick,
  Heart,
  Plug
} from 'lucide-react'
import { forwardRef } from 'react'
import { useTranslation } from 'react-i18next'
import ChargeZapLimitInput from './ChargeZapLimitInput'
import ChargeZapSwitch from './ChargeZapSwitch'
import DefaultZapAmountInput from './DefaultZapAmountInput'
import DefaultZapCommentInput from './DefaultZapCommentInput'
import LightningAddressInput from './LightningAddressInput'
import OnlyZapsModeSwitch from './OnlyZapsModeSwitch'
import QuickZapSwitch from './QuickZapSwitch'
import ZapOnReactionsSwitch from './ZapOnReactionsSwitch'
import ZapSoundSelect from './ZapSoundSelect'

const WalletPage = forwardRef(({ index }: { index?: number }, ref) => {
  const { t } = useTranslation()
  const { isWalletConnected, walletInfo } = useZap()

  return (
    <SecondaryPageLayout ref={ref} index={index} title={t('Wallet')}>
      {isWalletConnected ? (
        <div className="px-4 pt-3 pb-6 space-y-3">
          {/* Wallet Connection Info Card */}
          <Card>
            <CardHeader className="pb-2 pt-4">
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5" />
                <CardTitle className="text-lg">{t('Wallet Connection')}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pb-4">
              {walletInfo?.node.alias && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t('Connected to')}</span>
                  <strong>{walletInfo.node.alias}</strong>
                </div>
              )}
              {'balance' in (walletInfo || {}) && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t('Balance')}</span>
                  <strong className="text-lg">
                    {((walletInfo as unknown as { balance: number }).balance ?? 0).toLocaleString()} sats
                  </strong>
                </div>
              )}
              <Separator />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="w-full">{t('Disconnect Wallet')}</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('Are you absolutely sure?')}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t('You will not be able to send zaps to others.')}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
                    <AlertDialogAction variant="destructive" onClick={() => disconnect()}>
                      {t('Disconnect')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>

          {/* Zap Defaults Card */}
          <Card>
            <CardHeader className="pb-2 pt-4">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5" />
                <CardTitle className="text-lg">{t('Zap Defaults')}</CardTitle>
              </div>
              <CardDescription>{t('Configure default zap settings')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pb-4">
              <DefaultZapAmountInput />
              <DefaultZapCommentInput />
            </CardContent>
          </Card>

          {/* Quick Zap Settings Card */}
          <Card>
            <CardHeader className="pb-2 pt-4">
              <div className="flex items-center gap-2">
                <MousePointerClick className="w-5 h-5" />
                <CardTitle className="text-lg">{t('Quick Zap')}</CardTitle>
              </div>
              <CardDescription>{t('Fast zapping with a single click')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pb-4">
              <QuickZapSwitch />
            </CardContent>
          </Card>

          {/* Charge Zap Settings Card */}
          <Card>
            <CardHeader className="pb-2 pt-4">
              <div className="flex items-center gap-2">
                <Plug className="w-5 h-5" />
                <CardTitle className="text-lg">{t('Charge Zaps')}</CardTitle>
              </div>
              <CardDescription>{t('Hold to charge and send larger zaps')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pb-4">
              <ChargeZapSwitch />
              <ChargeZapLimitInput />
            </CardContent>
          </Card>

          {/* Zap Behavior Card */}
          <Card>
            <CardHeader className="pb-2 pt-4">
              <div className="flex items-center gap-2">
                <Settings2 className="w-5 h-5" />
                <CardTitle className="text-lg">{t('Zap Behavior')}</CardTitle>
              </div>
              <CardDescription>{t('Customize how zapping works')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pb-4">
              <ZapOnReactionsSwitch />
              <OnlyZapsModeSwitch />
            </CardContent>
          </Card>

          {/* Sound Settings Card */}
          <Card>
            <CardHeader className="pb-2 pt-4">
              <div className="flex items-center gap-2">
                <Volume2 className="w-5 h-5" />
                <CardTitle className="text-lg">{t('Sound')}</CardTitle>
              </div>
              <CardDescription>{t('Choose a sound for zaps')}</CardDescription>
            </CardHeader>
            <CardContent className="pb-4">
              <ZapSoundSelect />
            </CardContent>
          </Card>

          {/* Receiving Zaps Card */}
          <Card>
            <CardHeader className="pb-2 pt-4">
              <div className="flex items-center gap-2">
                <Gauge className="w-5 h-5" />
                <CardTitle className="text-lg">{t('Receiving Zaps')}</CardTitle>
              </div>
              <CardDescription>{t('Configure how others can zap you')}</CardDescription>
            </CardHeader>
            <CardContent className="pb-4">
              <LightningAddressInput />
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="px-4 pt-3">
          <Card>
            <CardContent className="pt-6 text-center space-y-4">
              <div className="flex justify-center">
                <Wallet className="w-12 h-12 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2">{t('No Wallet Connected')}</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  {t('Connect a wallet to send and receive zaps on Nostr')}
                </p>
              </div>
              <Button onClick={() => launchModal()} size="lg" className="w-full">
                <Zap className="w-4 h-4 mr-2" />
                {t('Connect a Wallet')}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </SecondaryPageLayout>
  )
})
WalletPage.displayName = 'WalletPage'
export default WalletPage
