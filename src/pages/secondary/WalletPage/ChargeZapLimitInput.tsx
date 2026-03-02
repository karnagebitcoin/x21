import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useZap } from '@/providers/ZapProvider'
import { useTranslation } from 'react-i18next'

export default function ChargeZapLimitInput() {
  const { t } = useTranslation()
  const { chargeZapLimit, updateChargeZapLimit, chargeZapEnabled, isWalletConnected } = useZap()

  return (
    <div>
      <Label
        htmlFor="charge-zap-limit"
        className={(!chargeZapEnabled || !isWalletConnected) ? "opacity-50" : ""}
      >
        {t('Charge Zap Limit (sats)')}
      </Label>
      <div className={`text-sm text-muted-foreground mt-1 mb-2 ${(!chargeZapEnabled || !isWalletConnected) ? 'opacity-50' : ''}`}>
        {t('Maximum amount that can be charged. No matter how long you hold, zap won\'t exceed this limit.')}
      </div>
      <div className={`bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-3 mb-2 ${(!chargeZapEnabled || !isWalletConnected) ? 'opacity-50' : ''}`}>
        <div className="text-sm text-yellow-800 dark:text-yellow-200 font-medium">
          ⚠️ {t('Important: Set a reasonable limit')}
        </div>
        <div className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
          {t('This prevents accidentally sending large amounts. The zap amount will never exceed this limit.')}
        </div>
      </div>
      <Input
        id="charge-zap-limit"
        type="number"
        min="1"
        value={chargeZapLimit}
        onChange={(e) => {
          const value = parseInt(e.target.value)
          if (!isNaN(value) && value > 0) {
            updateChargeZapLimit(value)
          }
        }}
        disabled={!chargeZapEnabled || !isWalletConnected}
      />
    </div>
  )
}
