import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { JUMBLE_API_BASE_URL } from '@/constants'
import { useNostr } from '@/providers/NostrProvider'
import { useTranslationService } from '@/providers/TranslationServiceProvider'
import { Check, Copy, Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useJumbleTranslateAccount } from './JumbleTranslateAccountProvider'
import RegenerateApiKeyButton from './RegenerateApiKeyButton'
import TopUp from './TopUp'

export function AccountInfo() {
  const { t } = useTranslation()
  const { pubkey, startLogin } = useNostr()
  const { account } = useJumbleTranslateAccount()
  const { config, updateConfig } = useTranslationService()
  const [showApiKey, setShowApiKey] = useState(false)
  const [copied, setCopied] = useState(false)
  const autoTranslate = config.service === 'jumble' ? (config.auto_translate ?? false) : false

  if (!pubkey) {
    return (
      <div className="w-full flex justify-center">
        <Button onClick={() => startLogin()}>{t('Login')}</Button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border bg-muted/15 p-3 space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">{t('Balance', { defaultValue: 'Balance' })}</p>
            <p className="text-2xl font-bold leading-none">
              {(account?.balance ?? 0).toLocaleString()}
              <span className="ml-2 text-base font-medium text-muted-foreground">
                {t('credits', { defaultValue: 'credits' })}
              </span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg border bg-background/50 p-2">
            <p className="text-[11px] text-muted-foreground">
              {t('Bought', { defaultValue: 'Bought' })}
            </p>
            <p className="text-sm font-semibold">{(account?.purchased_credits ?? 0).toLocaleString()}</p>
          </div>
          <div className="rounded-lg border bg-background/50 p-2">
            <p className="text-[11px] text-muted-foreground">{t('Used', { defaultValue: 'Used' })}</p>
            <p className="text-sm font-semibold">{(account?.spent_credits ?? 0).toLocaleString()}</p>
          </div>
          <div className="rounded-lg border bg-background/50 p-2">
            <p className="text-[11px] text-muted-foreground">
              {t('Sats paid', { defaultValue: 'Sats paid' })}
            </p>
            <p className="text-sm font-semibold">{(account?.total_sats_paid ?? 0).toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <p className="font-medium">{t('X21 API key', { defaultValue: 'X21 API key' })}</p>
        <div className="flex items-center gap-2">
          <Input
            type={showApiKey ? 'text' : 'password'}
            value={account?.api_key ?? ''}
            readOnly
            className="font-mono flex-1"
          />
          <Button variant="outline" onClick={() => setShowApiKey(!showApiKey)}>
            {showApiKey ? <Eye /> : <EyeOff />}
          </Button>
          <Button
            variant="outline"
            disabled={!account?.api_key}
            onClick={() => {
              if (!account?.api_key) return
              navigator.clipboard.writeText(account.api_key)
              setCopied(true)
              setTimeout(() => setCopied(false), 4000)
            }}
          >
            {copied ? <Check /> : <Copy />}
          </Button>
          <RegenerateApiKeyButton />
        </div>
        <p className="text-sm text-muted-foreground select-text">
          {t('x21TranslateApiKeyDescription', {
            serviceUrl: new URL('/v1/translation', JUMBLE_API_BASE_URL).toString(),
            defaultValue:
              'Use this key for the X21 translation API endpoint: {{serviceUrl}}'
          })}
        </p>
      </div>
      <TopUp />

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="auto-translate" className="text-base font-medium">
            {t('Auto-translate notes', { defaultValue: 'Auto-translate notes' })}
          </Label>
          <Switch
            id="auto-translate"
            checked={autoTranslate}
            onCheckedChange={(checked) => {
              updateConfig({
                service: 'jumble',
                auto_translate: checked
              })
            }}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          {t('Automatically translate notes in foreign languages to your app language', {
            defaultValue: 'Automatically translate notes in foreign languages to your app language'
          })}
        </p>
      </div>
    </div>
  )
}
