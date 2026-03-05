import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
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
      <div className="px-4 pt-3 pb-6 space-y-4">
        <div className="rounded-xl border bg-card/60 px-4 py-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-full bg-primary/10 p-2 text-primary">
              <KeyRound className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              <h2 className="text-base font-semibold">{t('Keys')}</h2>
              <p className="text-sm text-muted-foreground">
                {t('Your public key is like your username. Your private key is like your password.')}
              </p>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-muted-foreground">{t('Sign-in method')}</span>
                <Badge variant="secondary">{t(getSignerTypeLabel(account?.signerType))}</Badge>
              </div>
            </div>
          </div>
        </div>

        {!pubkey ? (
          <Card>
            <CardContent className="pt-6 pb-5 text-sm text-muted-foreground">
              {t('Sign in to view key details for your account.')}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-4 pb-4 space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <UserRound className="w-4 h-4" />
                  {t('Public Key')}
                </div>
                <p className="text-sm text-muted-foreground">{t('Safe to share with others.')}</p>
                <div className="rounded-md border px-3 py-2 text-sm break-all">{npub}</div>
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => npub && copyText(npub, 'public')}
                >
                  {copiedField === 'public' ? <Check /> : <Copy />}
                  {copiedField === 'public' ? t('Copied!') : t('Copy public key')}
                </Button>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <ShieldAlert className="w-4 h-4" />
                  {t('Private Key')}
                </div>
                <p className="text-sm text-muted-foreground">
                  {t('Never share your private key. Anyone with it can control your account.')}
                </p>
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
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <ShieldCheck className="w-4 h-4" />
                  {t('Recovery')}
                </div>
                <p className="text-sm text-muted-foreground">
                  {t('Keep a backup so you can recover your account if you lose access.')}
                </p>
                <Button variant="outline" className="w-full" onClick={() => push(toBackupSettings())}>
                  {t('Open Backup & Sync')}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </SecondaryPageLayout>
  )
})

KeysSettingsPage.displayName = 'KeysSettingsPage'
export default KeysSettingsPage
