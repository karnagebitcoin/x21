import MailboxSetting, { TMailboxSettingSaveState } from '@/components/MailboxSetting'
import { Button } from '@/components/ui/button'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { useNostr } from '@/providers/NostrProvider'
import { Loader2 } from 'lucide-react'
import { forwardRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

const DEFAULT_SAVE_STATE: TMailboxSettingSaveState = {
  save: () => undefined,
  canSave: false,
  isSaving: false
}

const RelaySettingsPage = forwardRef(({ index }: { index?: number }, ref) => {
  const { t } = useTranslation()
  const { pubkey, relayList, checkLogin } = useNostr()
  const [saveState, setSaveState] = useState<TMailboxSettingSaveState>(DEFAULT_SAVE_STATE)

  const controls = pubkey && relayList
    ? (
        <Button
          size="sm"
          className="rounded-full"
          disabled={!saveState.canSave}
          onClick={saveState.save}
        >
          {saveState.isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
          {t('Save')}
        </Button>
      )
    : undefined

  return (
    <SecondaryPageLayout ref={ref} index={index} title={t('Relay settings')} controls={controls}>
      <div className="space-y-4 px-4 py-3">
        {!pubkey ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="text-sm text-muted-foreground">{t('Sign in to manage your relays')}</div>
            <Button size="lg" onClick={() => checkLogin()}>
              {t('Login')}
            </Button>
          </div>
        ) : !relayList ? (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {t('Loading relay settings...')}
          </div>
        ) : (
          <MailboxSetting onSaveStateChange={setSaveState} />
        )}
      </div>
    </SecondaryPageLayout>
  )
})
RelaySettingsPage.displayName = 'RelaySettingsPage'
export default RelaySettingsPage
