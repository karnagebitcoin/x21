import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { toBackupSettings } from '@/lib/link'
import { pubkeyToNpub } from '@/lib/pubkey'
import { useSecondaryPage } from '@/PageManager'
import { useNostr } from '@/providers/NostrProvider'
import { TSignerType } from '@/types'
import { Check, Copy, KeyRound, ShieldAlert, ShieldCheck, UserRound } from 'lucide-react'
import { forwardRef, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

type TCopiedField = 'public' | 'nsec' | 'ncryptsec' | null

function getSignerTypeLabel(signerType?: TSignerType) {
  if (signerType === 'nip-07') return 'Extension'
  if (signerType === 'bunker') return 'Remote signer'
  if (signerType === 'ncryptsec') return 'Encrypted key (ncryptsec)'
  if (signerType === 'nsec' || signerType === 'browser-nsec') return 'Private key (nsec)'
  if (signerType === 'npub') return 'Read-only (npub)'
  return 'Unknown'
}

function getUnavailablePrivateKeyReason(signerType?: TSignerType) {
  if (signerType === 'nip-07') {
    return 'You signed in with an extension, so your private key stays in the extension.'
  }
  if (signerType === 'bunker') {
    return 'You signed in with a remote signer, so your private key is managed there.'
  }
  if (signerType === 'npub') {
    return 'This account is read-only, so there is no private key to copy.'
  }
  return 'Your private key is not available on this device.'
}

const KeysSettingsPage = forwardRef(({ index }: { index?: number }, ref) => {
  const { t } = useTranslation()
  const { push } = useSecondaryPage()
  const { pubkey, account, nsec, ncryptsec } = useNostr()
  const [copiedField, setCopiedField] = useState<TCopiedField>(null)
  const npub = useMemo(() => (pubkey ? pubkeyToNpub(pubkey) : null), [pubkey])

  const copyText = async (value: string, field: Exclude<TCopiedField, null>) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedField(field)
      setTimeout(() => {
        setCopiedField((current) => (current === field ? null : current))
      }, 2000)
    } catch {
      toast.error(t('Failed to copy'))
    }
  }

  return (
    <SecondaryPageLayout ref={ref} index={index} title={t('Keys')}>
      <div className="px-4 pt-3 pb-6 space-y-3">
        <Card>
          <CardHeader className="pb-2 pt-4">
            <div className="flex items-center gap-2">
              <KeyRound className="w-5 h-5" />
              <CardTitle className="text-lg">{t('Keys')}</CardTitle>
            </div>
            <CardDescription>
              {t('Your public key is like your username. Your private key is like your password.')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pb-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">{t('Sign-in method')}</span>
              <Badge variant="secondary">{t(getSignerTypeLabel(account?.signerType))}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {t('Never share your private key. Anyone with it can control your account.')}
            </p>
          </CardContent>
        </Card>

        {!pubkey ? (
          <Card>
            <CardContent className="pt-6 pb-5 text-sm text-muted-foreground">
              {t('Sign in to view key details for your account.')}
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader className="pb-2 pt-4">
                <div className="flex items-center gap-2">
                  <UserRound className="w-5 h-5" />
                  <CardTitle className="text-lg">{t('Public Key')}</CardTitle>
                </div>
                <CardDescription>{t('Safe to share with others.')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pb-4">
                <div className="rounded-md border px-3 py-2 text-sm break-all">{npub}</div>
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => npub && copyText(npub, 'public')}
                >
                  {copiedField === 'public' ? <Check /> : <Copy />}
                  {copiedField === 'public' ? t('Copied!') : t('Copy public key')}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2 pt-4">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5" />
                  <CardTitle className="text-lg">{t('Private Key')}</CardTitle>
                </div>
                <CardDescription>{t('Keep this secret. Do not share it.')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pb-4">
                {!!nsec && (
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={() => copyText(nsec, 'nsec')}
                  >
                    {copiedField === 'nsec' ? <Check /> : <Copy />}
                    {copiedField === 'nsec' ? t('Copied!') : t('Copy private key (nsec)')}
                  </Button>
                )}
                {!!ncryptsec && (
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={() => copyText(ncryptsec, 'ncryptsec')}
                  >
                    {copiedField === 'ncryptsec' ? <Check /> : <Copy />}
                    {copiedField === 'ncryptsec'
                      ? t('Copied!')
                      : t('Copy encrypted private key (ncryptsec)')}
                  </Button>
                )}
                {!nsec && !ncryptsec && (
                  <div className="rounded-md border px-3 py-3 text-sm text-muted-foreground">
                    {t(getUnavailablePrivateKeyReason(account?.signerType))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2 pt-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5" />
                  <CardTitle className="text-lg">{t('Recovery')}</CardTitle>
                </div>
                <CardDescription>
                  {t('Keep a backup so you can recover your account if you lose access.')}
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-4">
                <Button variant="outline" className="w-full" onClick={() => push(toBackupSettings())}>
                  {t('Open Backup & Sync')}
                </Button>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </SecondaryPageLayout>
  )
})

KeysSettingsPage.displayName = 'KeysSettingsPage'
export default KeysSettingsPage
